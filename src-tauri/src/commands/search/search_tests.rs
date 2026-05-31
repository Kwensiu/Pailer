use super::{
    collect_candidate_buckets, get_or_populate_manifests_singleflight, invalidate_manifest_cache,
    normalize_bucket_scope, CachedManifest, ManifestCacheInvalidation, ManifestCacheSnapshot,
};
use crate::models::{MatchSource, ScoopPackage};
use once_cell::sync::Lazy;
use std::fs;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tempfile::tempdir;
use tokio::sync::Mutex;
use tokio::time::{sleep, timeout, Duration};

static SEARCH_CACHE_TEST_MUTEX: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));

fn manifest(bucket: &str, name: &str) -> CachedManifest {
    CachedManifest {
        package: ScoopPackage {
            name: name.to_string(),
            version: "1.0.0".to_string(),
            source: bucket.to_string(),
            updated: String::new(),
            is_installed: false,
            is_installed_from_current_bucket: true,
            info: String::new(),
            homepage: None,
            license: None,
            notes: None,
            match_source: MatchSource::Name,
            installation_type: Default::default(),
            has_multiple_versions: false,
            local_latest_version: None,
        },
        normalized_name: name.to_string(),
        normalized_bins: vec![],
    }
}

fn snapshot(manifests: Vec<CachedManifest>) -> ManifestCacheSnapshot {
    let mut bucket_vectors: std::collections::HashMap<String, Vec<CachedManifest>> =
        std::collections::HashMap::new();
    for manifest in manifests.iter().cloned() {
        bucket_vectors
            .entry(manifest.package.source.clone())
            .or_default()
            .push(manifest);
    }
    let buckets = bucket_vectors
        .into_iter()
        .map(|(bucket_name, bucket_manifests)| (bucket_name, Arc::new(bucket_manifests)))
        .collect();

    ManifestCacheSnapshot {
        flat: Arc::new(manifests),
        buckets,
    }
}

#[test]
fn collects_candidate_buckets_from_root_and_nested_bucket_dirs() {
    let temp_dir = tempdir().expect("temp dir");
    let buckets_dir = temp_dir.path().join("buckets");
    fs::create_dir_all(buckets_dir.join("alpha").join("bucket")).expect("alpha bucket dir");
    fs::create_dir_all(buckets_dir.join("beta")).expect("beta dir");
    fs::create_dir_all(buckets_dir.join("gamma").join("bucket")).expect("gamma bucket dir");

    fs::write(
        buckets_dir
            .join("alpha")
            .join("bucket")
            .join("firefox.json"),
        "{}",
    )
    .expect("write alpha manifest");
    fs::write(buckets_dir.join("beta").join("firefox.json"), "{}").expect("write beta manifest");
    fs::write(
        buckets_dir
            .join("gamma")
            .join("bucket")
            .join("not-firefox.json"),
        "{}",
    )
    .expect("write gamma manifest");

    let candidates =
        collect_candidate_buckets(&buckets_dir, "firefox").expect("collect candidates");

    assert_eq!(candidates, vec!["alpha".to_string(), "beta".to_string()]);
}

#[test]
fn bucket_scope_logs_are_stable_and_deduplicated() {
    let bucket_names = normalize_bucket_scope(["main", " extras ", "main", ""]);
    let refresh_scope = ManifestCacheInvalidation::RefreshBuckets {
        bucket_names: bucket_names.clone(),
        bucket_paths: vec![],
        reason: "bulk bucket update",
    };
    let remove_scope = ManifestCacheInvalidation::RemoveBuckets {
        bucket_names,
        reason: "bucket removed",
    };

    assert_eq!(
        refresh_scope.log_message(),
        "Manifest cache refreshed for bucket scope [extras, main] (bulk bucket update)."
    );
    assert_eq!(
        remove_scope.log_message(),
        "Manifest cache removed bucket scope [extras, main] (bucket removed)."
    );
}

#[tokio::test]
async fn singleflight_prevents_duplicate_population_for_concurrent_callers() {
    let _test_guard = SEARCH_CACHE_TEST_MUTEX.lock().await;
    invalidate_manifest_cache().await;

    let populate_calls = Arc::new(AtomicUsize::new(0));
    let mut tasks = Vec::new();

    for _ in 0..8 {
        let populate_calls = populate_calls.clone();
        tasks.push(tokio::spawn(async move {
            get_or_populate_manifests_singleflight(|| {
                let populate_calls = populate_calls.clone();
                async move {
                    populate_calls.fetch_add(1, Ordering::SeqCst);
                    sleep(Duration::from_millis(40)).await;
                    Ok(snapshot(vec![]))
                }
            })
            .await
        }));
    }

    let mut cold_count = 0usize;
    for task in tasks {
        let (_, was_cold) = task.await.expect("task join").expect("singleflight result");
        if was_cold {
            cold_count += 1;
        }
    }

    assert_eq!(populate_calls.load(Ordering::SeqCst), 1);
    assert_eq!(cold_count, 1);
    invalidate_manifest_cache().await;
}

#[tokio::test]
async fn failed_population_clears_inflight_and_allows_retry() {
    let _test_guard = SEARCH_CACHE_TEST_MUTEX.lock().await;
    invalidate_manifest_cache().await;

    let populate_calls = Arc::new(AtomicUsize::new(0));
    let first = get_or_populate_manifests_singleflight(|| {
        let populate_calls = populate_calls.clone();
        async move {
            populate_calls.fetch_add(1, Ordering::SeqCst);
            Err("boom".to_string())
        }
    })
    .await;

    assert!(first.is_err());

    let _second = timeout(
        Duration::from_secs(1),
        get_or_populate_manifests_singleflight(|| {
            let populate_calls = populate_calls.clone();
            async move {
                populate_calls.fetch_add(1, Ordering::SeqCst);
                Ok(snapshot(vec![]))
            }
        }),
    )
    .await
    .expect("retry should not hang")
    .expect("retry should succeed");

    assert_eq!(populate_calls.load(Ordering::SeqCst), 2);
    invalidate_manifest_cache().await;
}

#[tokio::test]
async fn invalidation_during_inflight_population_discards_stale_result() {
    let _test_guard = SEARCH_CACHE_TEST_MUTEX.lock().await;
    invalidate_manifest_cache().await;

    let stale_calls = Arc::new(AtomicUsize::new(0));
    let stale_task = tokio::spawn({
        let stale_calls = stale_calls.clone();
        async move {
            get_or_populate_manifests_singleflight(|| {
                let stale_calls = stale_calls.clone();
                async move {
                    let call_idx = stale_calls.fetch_add(1, Ordering::SeqCst);
                    if call_idx == 0 {
                        sleep(Duration::from_millis(80)).await;
                        Ok(snapshot(vec![]))
                    } else {
                        Err("stale populate should not be published".to_string())
                    }
                }
            })
            .await
        }
    });

    sleep(Duration::from_millis(20)).await;
    invalidate_manifest_cache().await;

    let fresh_calls = Arc::new(AtomicUsize::new(0));
    let fresh = timeout(
        Duration::from_secs(1),
        get_or_populate_manifests_singleflight(|| {
            let fresh_calls = fresh_calls.clone();
            async move {
                fresh_calls.fetch_add(1, Ordering::SeqCst);
                Ok(snapshot(vec![]))
            }
        }),
    )
    .await
    .expect("fresh populate should not hang")
    .expect("fresh populate should succeed");

    assert!(fresh.1);
    assert_eq!(fresh_calls.load(Ordering::SeqCst), 1);

    let cache_hit_calls = Arc::new(AtomicUsize::new(0));
    let cache_hit = timeout(
        Duration::from_secs(1),
        get_or_populate_manifests_singleflight(|| {
            let cache_hit_calls = cache_hit_calls.clone();
            async move {
                cache_hit_calls.fetch_add(1, Ordering::SeqCst);
                Ok(snapshot(vec![]))
            }
        }),
    )
    .await
    .expect("cache hit should not hang")
    .expect("cache hit should succeed");

    assert!(!cache_hit.1);
    assert_eq!(cache_hit_calls.load(Ordering::SeqCst), 0);

    let (_stale_manifests, was_cold) = stale_task
        .await
        .expect("stale task join")
        .expect("stale caller should retry or observe the fresh cache");
    assert!(!was_cold);
    invalidate_manifest_cache().await;
}

#[tokio::test]
async fn bucket_scope_removal_rebuilds_without_rescanning() {
    let _test_guard = SEARCH_CACHE_TEST_MUTEX.lock().await;
    invalidate_manifest_cache().await;

    let initial = snapshot(vec![
        manifest("extras", "alpha"),
        manifest("main", "beta"),
        manifest("main", "gamma"),
    ]);

    let _ = get_or_populate_manifests_singleflight({
        let initial = initial.clone();
        move || {
            let initial = initial.clone();
            async move { Ok(initial) }
        }
    })
    .await
    .expect("seed cache");

    super::remove_manifest_cache_for_buckets(["main"], "bucket removed").await;

    let populate_calls = Arc::new(AtomicUsize::new(0));
    let result = get_or_populate_manifests_singleflight(|| {
        let populate_calls = populate_calls.clone();
        async move {
            populate_calls.fetch_add(1, Ordering::SeqCst);
            Ok(snapshot(vec![]))
        }
    })
    .await
    .expect("cache read");

    assert!(!result.1);
    assert_eq!(populate_calls.load(Ordering::SeqCst), 0);
    assert_eq!(result.0.len(), 1);
    assert_eq!(result.0[0].package.source, "extras");
    invalidate_manifest_cache().await;
}

#[tokio::test]
async fn bucket_scope_refresh_replaces_only_changed_bucket() {
    let _test_guard = SEARCH_CACHE_TEST_MUTEX.lock().await;
    invalidate_manifest_cache().await;

    let temp_dir = tempdir().expect("temp dir");
    let buckets_dir = temp_dir.path().join("buckets");
    let main_bucket_dir = buckets_dir.join("main");
    let main_manifest_dir = main_bucket_dir.join("bucket");
    fs::create_dir_all(&main_manifest_dir).expect("main manifest dir");
    fs::write(
        main_manifest_dir.join("beta-new.json"),
        r#"{ "version": "2.0.0" }"#,
    )
    .expect("write refreshed manifest");

    let initial = snapshot(vec![
        manifest("extras", "alpha"),
        manifest("main", "beta-old"),
    ]);

    let _ = get_or_populate_manifests_singleflight({
        let initial = initial.clone();
        move || {
            let initial = initial.clone();
            async move { Ok(initial) }
        }
    })
    .await
    .expect("seed cache");

    super::refresh_manifest_cache_for_bucket("main", main_bucket_dir, "bucket update").await;

    let populate_calls = Arc::new(AtomicUsize::new(0));
    let result = get_or_populate_manifests_singleflight(|| {
        let populate_calls = populate_calls.clone();
        async move {
            populate_calls.fetch_add(1, Ordering::SeqCst);
            Ok(snapshot(vec![]))
        }
    })
    .await
    .expect("cache read");

    assert!(!result.1);
    assert_eq!(populate_calls.load(Ordering::SeqCst), 0);
    let package_names = result
        .0
        .iter()
        .map(|manifest| manifest.package.name.as_str())
        .collect::<Vec<_>>();
    assert_eq!(package_names, vec!["alpha", "beta-new"]);
    invalidate_manifest_cache().await;
}
