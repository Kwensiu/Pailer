//! Commands for searching Scoop packages.
use crate::commands::installed::get_installed_packages_full;
use crate::models::{parse_notes_field, MatchSource, ScoopPackage, SearchResult};
use crate::state::AppState;
use crate::utils;
use once_cell::sync::Lazy;
use rayon::prelude::*;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_store::StoreExt;
use tokio::sync::Mutex;

type ManifestCache = Arc<Vec<CachedManifest>>;
type NameToBuckets = Arc<HashMap<String, Vec<String>>>;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageBucketContext {
    pub current_bucket: Option<String>,
    pub candidate_buckets: Vec<String>,
}

fn collect_candidate_buckets(
    buckets_dir: &Path,
    normalized_name: &str,
) -> Result<Vec<String>, String> {
    let manifest_filename = format!("{}.json", normalized_name);
    let mut candidate_buckets = Vec::new();

    if !buckets_dir.is_dir() {
        return Ok(candidate_buckets);
    }

    let entries = std::fs::read_dir(buckets_dir)
        .map_err(|e| format!("Failed to read buckets directory '{}': {}", buckets_dir.display(), e))?;

    for entry in entries.flatten() {
        let bucket_path = entry.path();
        if !bucket_path.is_dir() {
            continue;
        }

        let root_manifest_path = bucket_path.join(&manifest_filename);
        let nested_manifest_path = bucket_path.join("bucket").join(&manifest_filename);

        if root_manifest_path.exists() || nested_manifest_path.exists() {
            if let Some(bucket_name) = bucket_path.file_name().and_then(|name| name.to_str()) {
                candidate_buckets.push(bucket_name.to_string());
            }
        }
    }

    Ok(candidate_buckets)
}

#[derive(Clone, Debug)]
struct CachedManifest {
    package: ScoopPackage,
    normalized_name: String,
    normalized_bins: Vec<String>,
}

struct SearchQuery {
    normalized_term: String,
    exact: bool,
}

static MANIFEST_CACHE: Lazy<Mutex<Option<ManifestCache>>> = Lazy::new(|| Mutex::new(None));
static NAME_TO_BUCKETS: Lazy<Mutex<Option<NameToBuckets>>> = Lazy::new(|| Mutex::new(None));

fn is_manifest_cache_prebuild_enabled<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> bool {
    let store = match app.store(PathBuf::from("settings.json")) {
        Ok(store) => store,
        Err(error) => {
            log::warn!(
                "search cache prebuild setting could not be loaded, defaulting to disabled: {}",
                error
            );
            return false;
        }
    };

    store
        .get("settings")
        .and_then(|settings| settings.get("search").cloned())
        .and_then(|search| {
            search
                .get("allowCachePrebuild")
                .and_then(|value| value.as_bool())
        })
        .unwrap_or(false)
}

/// Finds all `.json` manifest files in a given bucket's `bucket` subdirectory.
fn find_manifests_in_bucket(bucket_path: PathBuf) -> Vec<PathBuf> {
    let manifests_path = bucket_path.join("bucket");
    if !manifests_path.is_dir() {
        return vec![];
    }

    match std::fs::read_dir(manifests_path) {
        Ok(entries) => entries
            .filter_map(Result::ok)
            .filter(|entry| entry.path().extension().and_then(|s| s.to_str()) == Some("json"))
            .map(|entry| entry.path())
            .collect(),
        Err(_) => vec![],
    }
}

fn normalize_search_text(value: &str) -> String {
    value.trim().replace(' ', "-").to_ascii_lowercase()
}

fn parse_search_query(term: &str) -> Result<SearchQuery, String> {
    let trimmed = term.trim();
    if trimmed.is_empty() {
        return Err("Search term cannot be empty".to_string());
    }

    let exact = trimmed.len() > 1
        && ((trimmed.starts_with('\'') && trimmed.ends_with('\''))
            || (trimmed.starts_with('"') && trimmed.ends_with('"')));

    let raw_term = if exact {
        &trimmed[1..trimmed.len() - 1]
    } else {
        trimmed
    };

    let normalized_term = normalize_search_text(raw_term);
    if normalized_term.is_empty() {
        return Err("Search term cannot be empty".to_string());
    }

    Ok(SearchQuery {
        normalized_term,
        exact,
    })
}

fn extract_bin_values(value: &Value, output: &mut Vec<String>) {
    match value {
        Value::String(s) => output.push(normalize_search_text(s)),
        Value::Array(arr) => {
            for entry in arr {
                extract_bin_values(entry, output);
            }
        }
        Value::Object(obj) => {
            for (key, value) in obj {
                output.push(normalize_search_text(key));
                extract_bin_values(value, output);
            }
        }
        _ => {}
    }
}

fn parse_cached_manifest(path: &Path) -> Option<CachedManifest> {
    let file_name = path.file_stem().and_then(|s| s.to_str())?.to_string();
    let content = std::fs::read_to_string(path).ok()?;
    let json: Value = serde_json::from_str(&content).ok()?;
    let version = json.get("version").and_then(|v| v.as_str())?.to_string();
    let bucket = path.parent()?.parent()?.file_name()?.to_str()?.to_string();

    // Get metadata after content read (kernel may cache)
    let updated = fs::metadata(path)
        .and_then(|m| m.modified())
        .map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339())
        .unwrap_or_default();

    let homepage = json
        .get("homepage")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let license = json
        .get("license")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let notes = parse_notes_field(&json);
    let mut normalized_bins = Vec::new();

    if let Some(bin) = json.get("bin") {
        extract_bin_values(bin, &mut normalized_bins);
    }

    Some(CachedManifest {
        normalized_name: normalize_search_text(&file_name),
        normalized_bins,
        package: ScoopPackage {
            name: file_name,
            version,
            source: bucket,
            updated,
            homepage,
            license,
            notes,
            is_installed_from_current_bucket: true,
            match_source: MatchSource::Name,
            ..Default::default()
        },
    })
}

async fn populate_manifest_cache(scoop_path: &Path) -> Result<ManifestCache, String> {
    let buckets_path = scoop_path.join("buckets");
    if !tokio::fs::try_exists(&buckets_path).await.unwrap_or(false) {
        return Err("Scoop buckets directory not found".to_string());
    }

    let mut read_dir = tokio::fs::read_dir(&buckets_path)
        .await
        .map_err(|e| format!("Failed to read buckets directory: {}", e))?;
    let mut manifest_paths = Vec::new();

    while let Ok(Some(entry)) = read_dir.next_entry().await {
        if entry.path().is_dir() {
            manifest_paths.extend(find_manifests_in_bucket(entry.path()));
        }
    }

    tokio::task::spawn_blocking(move || {
        let manifests = manifest_paths
            .par_iter()
            .filter_map(|path| parse_cached_manifest(path))
            .collect::<Vec<_>>();
        Arc::new(manifests)
    })
    .await
    .map_err(|e| e.to_string())
}

async fn get_manifests<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
) -> Result<(ManifestCache, bool), String> {
    // Try to get cache
    let guard = MANIFEST_CACHE.lock().await;
    if let Some(cache) = guard.as_ref() {
        return Ok((cache.clone(), false));
    }
    drop(guard); // Release lock before populating

    // Populate cache
    log::info!("Cold search: Populating manifest cache.");
    let state = app.state::<AppState>();
    let scoop_path = state.scoop_path();
    let manifests = populate_manifest_cache(&scoop_path).await?;

    // Build name_to_buckets index
    let mut name_to_buckets_map: HashMap<String, Vec<String>> = HashMap::new();
    for manifest in manifests.iter() {
        name_to_buckets_map
            .entry(manifest.normalized_name.clone())
            .or_default()
            .push(manifest.package.source.clone());
    }
    let name_to_buckets = Arc::new(name_to_buckets_map);

    // Store results
    let mut guard = MANIFEST_CACHE.lock().await;
    *guard = Some(manifests.clone());
    *NAME_TO_BUCKETS.lock().await = Some(name_to_buckets.clone());

    Ok((manifests, true))
}

fn match_query(value: &str, query: &SearchQuery) -> bool {
    if query.exact {
        value == query.normalized_term
    } else {
        value.contains(&query.normalized_term)
    }
}

/// Searches for Scoop packages based on a search term.
#[tauri::command]
pub async fn search_scoop<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    term: String,
) -> Result<SearchResult, String> {
    if term.is_empty() {
        return Ok(SearchResult::default());
    }

    log::info!("search_scoop: Starting search for term: '{}'", term);
    let search_start = std::time::Instant::now();

    let (manifest_paths, is_cold) = get_manifests(app.clone()).await?;
    let cache_time = search_start.elapsed();

    if is_cold {
        log::warn!(
            "search_scoop: ⚠ Cache was cold! Had to populate manifest cache during search (took {:.2}s). This should not happen if cold-start completed.",
            cache_time.as_secs_f64()
        );
    } else {
        log::info!(
            "search_scoop: ✓ Using pre-warmed manifest cache ({} manifests, retrieved in {:.2}ms)",
            manifest_paths.len(),
            cache_time.as_millis()
        );
    }

    let query = parse_search_query(&term)?;

    let manifest_cache = manifest_paths.clone();

    let mut packages: Vec<ScoopPackage> = tokio::task::spawn_blocking(move || {
        manifest_cache
            .par_iter()
            .filter_map(|manifest| {
                let name_matches = match_query(&manifest.normalized_name, &query);
                let match_source = if name_matches {
                    MatchSource::Name
                } else if manifest
                    .normalized_bins
                    .iter()
                    .any(|value| match_query(value, &query))
                {
                    MatchSource::Binary
                } else {
                    MatchSource::None
                };

                if match_source == MatchSource::None {
                    return None;
                }

                let mut pkg = manifest.package.clone();
                pkg.match_source = match_source;
                Some(pkg)
            })
            .collect()
    })
    .await
    .map_err(|e| e.to_string())?;

    // Determine which packages are already installed
    let state = app.state::<AppState>();
    if let Ok(installed_pkgs) = get_installed_packages_full(app.clone(), state).await {
        let installed_map: HashMap<String, String> = installed_pkgs
            .into_iter()
            .map(|p| (p.name.to_lowercase(), p.source))
            .collect();

        for pkg in &mut packages {
            if let Some(installed_source) = installed_map.get(&pkg.name.to_lowercase()) {
                pkg.is_installed = true;
                pkg.is_installed_from_current_bucket =
                    installed_source.eq_ignore_ascii_case(&pkg.source);
            }
        }
    }

    let total_time = search_start.elapsed();
    log::info!(
        "search_scoop: ✓ Found {} packages matching '{}' in {:.2}s",
        packages.len(),
        term,
        total_time.as_secs_f64()
    );

    Ok(SearchResult { packages, is_cold })
}

/// Returns the current installed bucket and exact candidate buckets for a package.
/// This is intentionally scoped to the change-bucket flow and avoids warming the
/// global search manifest cache for a single-package lookup.
#[tauri::command]
pub async fn get_package_buckets<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    package_name: String,
) -> Result<PackageBucketContext, String> {
    let normalized_name = normalize_search_text(&package_name);
    if normalized_name.is_empty() {
        return Ok(PackageBucketContext {
            current_bucket: None,
            candidate_buckets: vec![],
        });
    }

    let scoop_path = app.state::<AppState>().scoop_path();
    let buckets_dir = scoop_path.join("buckets");
    let mut candidate_buckets = collect_candidate_buckets(&buckets_dir, &normalized_name)?;

    let current_bucket = utils::get_installed_package_bucket(&scoop_path, &package_name);
    if let Some(current_bucket_name) = current_bucket.as_ref() {
        if !candidate_buckets
            .iter()
            .any(|bucket| bucket.eq_ignore_ascii_case(current_bucket_name))
        {
            candidate_buckets.insert(0, current_bucket_name.clone());
        }
    }

    Ok(PackageBucketContext {
        current_bucket,
        candidate_buckets,
    })
}

#[cfg(test)]
mod search_tests;

/// Warms (populates) the global manifest cache if it is empty. Intended for use by the
/// cold-start routine so that the first search from the UI is instant.
///
/// Returns Ok(()) on success or an error string if the cache population failed.
pub async fn warm_manifest_cache<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
) -> Result<(), String> {
    if !is_manifest_cache_prebuild_enabled(&app) {
        log::info!(
            "warm_manifest_cache: Skipping manifest cache warm-up because search.allowCachePrebuild is disabled"
        );
        return Ok(());
    }

    log::info!("warm_manifest_cache: Starting manifest cache warm-up");
    let start_time = std::time::Instant::now();
    let result = get_manifests(app).await;
    let elapsed = start_time.elapsed();

    match result {
        Ok((paths, was_cold)) => {
            log::info!(
                "warm_manifest_cache: ✓ Cache warmed in {:.2}s - {} manifests loaded (was_cold: {})",
                elapsed.as_secs_f64(),
                paths.len(),
                was_cold
            );
            Ok(())
        }
        Err(e) => {
            log::error!(
                "warm_manifest_cache: ✗ Failed after {:.2}s - {}",
                elapsed.as_secs_f64(),
                e
            );
            Err(e)
        }
    }
}

/// Invalidates the global manifest cache.
/// This should be called after operations that change the available packages,
/// such as installing or uninstalling a package or adding/removing buckets.
pub async fn invalidate_manifest_cache() {
    *MANIFEST_CACHE.lock().await = None;
    *NAME_TO_BUCKETS.lock().await = None;
    log::info!("Manifest cache invalidated.");
}
