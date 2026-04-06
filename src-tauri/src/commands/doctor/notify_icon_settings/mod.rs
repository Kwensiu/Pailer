use crate::state::AppState;
use lazy_static::lazy_static;
use serde::Deserialize;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Manager, State};
use tokio::sync::Mutex;

mod model;
#[cfg(windows)]
mod plan;
#[cfg(windows)]
mod registry;

#[derive(Serialize, Debug, Clone)]
pub struct NotifyIconDedupePair {
    pub identity: String,
    pub keep_subkey: String,
    pub keep_path: String,
    pub drop_subkey: String,
    pub drop_path: String,
    pub propagated_is_promoted: Option<u32>,
}

#[derive(Serialize, Debug)]
pub struct NotifyIconDedupeResult {
    pub candidates: usize,
    pub deduped: usize,
    pub dropped: usize,
    pub propagated: usize,
    pub failed: Vec<String>,
    pub pairs: Vec<NotifyIconDedupePair>,
}

#[derive(serde::Deserialize, Debug)]
pub struct ApplySingleDedupeArgs {
    pub keep_subkey: String,
    pub drop_subkey: String,
    pub propagated_is_promoted: Option<u32>,
}

#[derive(Serialize, Debug)]
pub struct ApplySingleDedupeResult {
    pub keep_subkey: String,
    pub drop_subkey: String,
    pub propagated: bool,
    pub dropped: bool,
}

#[derive(serde::Deserialize, Debug, Clone)]
pub struct TrayMigrationPrepareArgs {
    pub operation_id: String,
    pub operation_type: String,
    pub package_name: Option<String>,
    pub preserve_versioned_installs: Option<bool>,
}

#[derive(serde::Deserialize, Debug, Clone)]
pub struct TrayMigrationFinalizeArgs {
    pub operation_id: String,
}

#[derive(Serialize, Debug, Clone)]
pub struct TrayMigrationRecord {
    pub package_name: String,
    pub identity: String,
    pub subkey: String,
    pub executable_path: String,
    pub promoted: Option<u32>,
}

#[derive(Clone, Debug)]
pub(super) struct TrayMigrationSnapshot {
    pub operation_type: String,
    pub preserve_multi_version_installs: bool,
    pub created_at_secs: u64,
    pub records: Vec<TrayMigrationRecord>,
}

#[derive(Serialize, Debug)]
pub struct TrayMigrationPrepareResult {
    pub operation_id: String,
    pub captured: usize,
    pub package_count: usize,
}

#[derive(Serialize, Debug)]
pub struct TrayMigrationFinalizeResult {
    pub operation_id: String,
    pub rewritten_paths: usize,
    pub propagated_is_promoted: usize,
    pub removed_duplicates: usize,
    pub skipped_multi_version: usize,
    pub failed: Vec<String>,
}

#[derive(Serialize, Debug)]
pub struct TrayMigrationDiscardResult {
    pub operation_id: String,
    pub discarded: bool,
}

#[cfg(windows)]
#[derive(Deserialize)]
struct PendingSelfUpdateTrayRecord {
    #[serde(rename = "SubKey")]
    subkey: String,
    #[serde(rename = "ExecutablePath")]
    executable_path: String,
    #[serde(rename = "IsPromoted")]
    is_promoted: Option<u32>,
}

#[cfg(windows)]
#[derive(Deserialize)]
#[serde(untagged)]
enum PendingSelfUpdateTraySnapshot {
    Many(Vec<PendingSelfUpdateTrayRecord>),
    One(PendingSelfUpdateTrayRecord),
}

lazy_static! {
    static ref TRAY_MIGRATION_SNAPSHOTS: Mutex<HashMap<String, TrayMigrationSnapshot>> =
        Mutex::new(HashMap::new());
}

#[cfg(windows)]
const TRAY_MIGRATION_SNAPSHOT_TTL_SECS: u64 = 60 * 60;
#[cfg(windows)]
const PENDING_SELF_UPDATE_TRAY_SNAPSHOT_FILE: &str = "pailer-self-update-tray-snapshot.json";

#[cfg(windows)]
pub fn pending_self_update_tray_snapshot_path() -> PathBuf {
    std::env::temp_dir().join(PENDING_SELF_UPDATE_TRAY_SNAPSHOT_FILE)
}

#[cfg(not(windows))]
pub fn pending_self_update_tray_snapshot_path() -> PathBuf {
    std::env::temp_dir().join("pailer-self-update-tray-snapshot.json")
}

#[cfg(windows)]
fn now_epoch_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

#[cfg(windows)]
fn prune_tray_migration_snapshots(map: &mut HashMap<String, TrayMigrationSnapshot>) -> usize {
    let now = now_epoch_secs();
    let before = map.len();
    map.retain(|_, snapshot| {
        now.saturating_sub(snapshot.created_at_secs) <= TRAY_MIGRATION_SNAPSHOT_TTL_SECS
    });
    before.saturating_sub(map.len())
}

#[cfg(windows)]
fn run_notify_icon_dedupe(
    dry_run: bool,
    prefixes: &[String],
) -> Result<NotifyIconDedupeResult, String> {
    let parent = registry::open_notify_icon_settings(dry_run)?;
    let (entries, failed) = registry::collect_scoop_notify_entries(&parent, prefixes);

    if cfg!(debug_assertions) {
        log::debug!(
            "[notify_icon_settings][dedupe] start: entries={}, prefixes={:?}",
            entries.len(),
            prefixes
        );
    }

    let plan = plan::build_dedupe_plan(entries, prefixes, failed);
    let mut deduped = 0usize;
    let mut dropped = 0usize;
    let mut propagated = 0usize;
    let mut failed = plan.failed;

    if !dry_run {
        let mut propagated_once: HashSet<String> = HashSet::new();
        let mut deduped_identities: HashSet<String> = HashSet::new();

        for pair in &plan.pairs {
            if let Some(value) = pair.propagated_is_promoted {
                if propagated_once.insert(pair.keep_subkey.clone()) {
                    match registry::set_is_promoted(&parent, &pair.keep_subkey, value) {
                        Ok(()) => propagated += 1,
                        Err(err) => failed.push(err),
                    }
                }
            }

            match registry::delete_notify_icon_subkey(&parent, &pair.drop_subkey) {
                Ok(()) => {
                    deduped_identities.insert(pair.identity.clone());
                    dropped += 1;
                }
                Err(err) => failed.push(err),
            }
        }

        deduped = deduped_identities.len();
    }

    Ok(NotifyIconDedupeResult {
        candidates: plan.pairs.len(),
        deduped,
        dropped,
        propagated,
        failed,
        pairs: plan.pairs,
    })
}

#[cfg(windows)]
#[tauri::command]
pub async fn prepare_tray_config_migration(
    state: State<'_, AppState>,
    args: TrayMigrationPrepareArgs,
) -> Result<TrayMigrationPrepareResult, String> {
    let scoop_root = state.scoop_path();
    let prefixes = model::build_scoop_prefixes(&scoop_root);
    let parent = registry::open_notify_icon_settings(true)?;
    let (entries, _failed) = registry::collect_scoop_notify_entries(&parent, &prefixes);

    let target_package = args
        .package_name
        .as_deref()
        .filter(|package_name| !package_name.is_empty() && *package_name != "all-packages");
    let records = plan::collect_tray_migration_records(entries, &prefixes, target_package);

    let package_count = records
        .iter()
        .map(|record| record.package_name.clone())
        .collect::<HashSet<_>>()
        .len();

    let captured = records.len();
    let mut guard = TRAY_MIGRATION_SNAPSHOTS.lock().await;
    let pruned = prune_tray_migration_snapshots(&mut guard);
    if cfg!(debug_assertions) && pruned > 0 {
        log::debug!(
            "[tray-migration] pruned stale snapshots before prepare: {}",
            pruned
        );
    }
    guard.insert(
        args.operation_id.clone(),
        TrayMigrationSnapshot {
            operation_type: args.operation_type,
            preserve_multi_version_installs: args.preserve_versioned_installs.unwrap_or(true),
            created_at_secs: now_epoch_secs(),
            records,
        },
    );

    Ok(TrayMigrationPrepareResult {
        operation_id: args.operation_id,
        captured,
        package_count,
    })
}

#[cfg(windows)]
async fn finalize_tray_config_migration_impl(
    scoop_root: std::path::PathBuf,
    args: TrayMigrationFinalizeArgs,
) -> Result<TrayMigrationFinalizeResult, String> {
    let snapshot = {
        let mut guard = TRAY_MIGRATION_SNAPSHOTS.lock().await;
        let _ = prune_tray_migration_snapshots(&mut guard);
        guard.remove(&args.operation_id)
    };

    let Some(snapshot) = snapshot else {
        return Ok(TrayMigrationFinalizeResult {
            operation_id: args.operation_id,
            rewritten_paths: 0,
            propagated_is_promoted: 0,
            removed_duplicates: 0,
            skipped_multi_version: 0,
            failed: Vec::new(),
        });
    };

    let prefixes = model::build_scoop_prefixes(&scoop_root);
    let parent = registry::open_notify_icon_settings(false)?;
    let (entries, failed) = registry::collect_scoop_notify_entries(&parent, &prefixes);
    let migration_plan =
        plan::build_migration_plan(&snapshot, entries, &scoop_root, &prefixes, failed);

    let mut failed = migration_plan.failed;
    let mut rewritten_paths = 0usize;
    let mut propagated_is_promoted = 0usize;
    let mut removed_duplicates = 0usize;

    for rewrite in &migration_plan.rewrites {
        match registry::set_executable_path(&parent, &rewrite.subkey, &rewrite.path) {
            Ok(()) => rewritten_paths += 1,
            Err(err) => failed.push(err),
        }
    }

    let mut propagated_once: HashSet<String> = HashSet::new();
    for propagation in &migration_plan.propagations {
        if !propagated_once.insert(propagation.subkey.clone()) {
            continue;
        }
        match registry::set_is_promoted(&parent, &propagation.subkey, propagation.value) {
            Ok(()) => propagated_is_promoted += 1,
            Err(err) => failed.push(err),
        }
    }

    for deletion in &migration_plan.deletions {
        match registry::delete_notify_icon_subkey(&parent, &deletion.subkey) {
            Ok(()) => removed_duplicates += 1,
            Err(err) => failed.push(err),
        }
    }

    if cfg!(debug_assertions) {
        log::debug!(
            "[tray-migration] finalized op={} type={} rewritten={} propagated={} removed={} skipped_multi_version={} failed={}",
            args.operation_id,
            snapshot.operation_type,
            rewritten_paths,
            propagated_is_promoted,
            removed_duplicates,
            migration_plan.skipped_multi_version,
            failed.len()
        );
    }

    Ok(TrayMigrationFinalizeResult {
        operation_id: args.operation_id,
        rewritten_paths,
        propagated_is_promoted,
        removed_duplicates,
        skipped_multi_version: migration_plan.skipped_multi_version,
        failed,
    })
}

#[cfg(windows)]
#[tauri::command]
pub async fn finalize_tray_config_migration(
    state: State<'_, AppState>,
    args: TrayMigrationFinalizeArgs,
) -> Result<TrayMigrationFinalizeResult, String> {
    finalize_tray_config_migration_impl(state.scoop_path(), args).await
}

#[cfg(windows)]
#[tauri::command]
pub async fn discard_tray_config_migration(
    args: TrayMigrationFinalizeArgs,
) -> Result<TrayMigrationDiscardResult, String> {
    let removed = {
        let mut guard = TRAY_MIGRATION_SNAPSHOTS.lock().await;
        let _ = prune_tray_migration_snapshots(&mut guard);
        guard.remove(&args.operation_id).is_some()
    };
    Ok(TrayMigrationDiscardResult {
        operation_id: args.operation_id,
        discarded: removed,
    })
}

#[cfg(windows)]
pub async fn apply_pending_self_update_tray_migration(
    app: tauri::AppHandle,
) -> Result<Option<TrayMigrationFinalizeResult>, String> {
    let snapshot_path = pending_self_update_tray_snapshot_path();
    if !snapshot_path.exists() {
        return Ok(None);
    }

    let app_state = app
        .try_state::<AppState>()
        .ok_or_else(|| "AppState is not available".to_string())?;
    let scoop_root = app_state.scoop_path();
    let prefixes = model::build_scoop_prefixes(&scoop_root);

    let raw = std::fs::read_to_string(&snapshot_path).map_err(|e| {
        format!(
            "Failed to read pending self-update tray snapshot '{}': {}",
            snapshot_path.display(),
            e
        )
    })?;
    let _ = std::fs::remove_file(&snapshot_path);
    let raw = raw.trim_start_matches('\u{FEFF}');
    let pending_records = match serde_json::from_str::<PendingSelfUpdateTraySnapshot>(raw) {
        Ok(PendingSelfUpdateTraySnapshot::Many(records)) => records,
        Ok(PendingSelfUpdateTraySnapshot::One(record)) => vec![record],
        Err(e) => {
            return Err(format!(
                "Failed to parse pending self-update tray snapshot '{}': {}",
                snapshot_path.display(),
                e
            ))
        }
    };

    let preserve_multi_version = crate::commands::settings::get_config_value(
        app.clone(),
        "automation.preserveTrayEntriesForVersionedInstalls".to_string(),
    )
    .ok()
    .flatten()
    .and_then(|v| v.as_bool())
    .unwrap_or(true);

    let operation_id = format!("self-update-startup-{}", now_epoch_secs());
    let mut records = Vec::new();

    for record in pending_records {
        let Some(path) = model::normalize_executable_path(&record.executable_path) else {
            continue;
        };
        if !model::looks_like_filesystem_path(&path)
            || !model::is_scoop_related_path(&path, &prefixes)
        {
            continue;
        }
        let path_norm = model::to_normcase_path(&path);
        let Some(package_name) = model::extract_package_name(&path_norm, &prefixes) else {
            continue;
        };
        let Some(identity) = model::logical_identity(&path_norm, &prefixes) else {
            continue;
        };
        records.push(TrayMigrationRecord {
            package_name,
            identity,
            subkey: record.subkey,
            executable_path: path,
            promoted: record.is_promoted,
        });
    }

    if records.is_empty() {
        log::info!("[tray-migration][self-update] pending snapshot contained no usable records");
        return Ok(None);
    }

    {
        let mut guard = TRAY_MIGRATION_SNAPSHOTS.lock().await;
        let _ = prune_tray_migration_snapshots(&mut guard);
        guard.insert(
            operation_id.clone(),
            TrayMigrationSnapshot {
                operation_type: "self-update-startup".to_string(),
                preserve_multi_version_installs: preserve_multi_version,
                created_at_secs: now_epoch_secs(),
                records,
            },
        );
    }

    let result = finalize_tray_config_migration_impl(
        scoop_root,
        TrayMigrationFinalizeArgs {
            operation_id: operation_id.clone(),
        },
    )
    .await?;

    log::info!(
        "[tray-migration][self-update] finalized op={} rewritten={} propagated={} removed={} skipped_multi_version={} failed={}",
        operation_id,
        result.rewritten_paths,
        result.propagated_is_promoted,
        result.removed_duplicates,
        result.skipped_multi_version,
        result.failed.len()
    );

    Ok(Some(result))
}

#[cfg(not(windows))]
pub async fn apply_pending_self_update_tray_migration(
    _app: tauri::AppHandle,
) -> Result<Option<TrayMigrationFinalizeResult>, String> {
    Ok(None)
}

#[cfg(windows)]
#[tauri::command]
pub fn preview_dedupe_notify_icon_settings(
    state: State<'_, AppState>,
) -> Result<NotifyIconDedupeResult, String> {
    let prefixes = model::build_scoop_prefixes(&state.scoop_path());
    run_notify_icon_dedupe(true, &prefixes)
}

#[cfg(windows)]
#[tauri::command]
pub fn apply_dedupe_notify_icon_settings(
    state: State<'_, AppState>,
) -> Result<NotifyIconDedupeResult, String> {
    let prefixes = model::build_scoop_prefixes(&state.scoop_path());
    run_notify_icon_dedupe(false, &prefixes)
}

#[cfg(windows)]
#[tauri::command]
pub fn apply_single_dedupe_notify_icon_pair(
    args: ApplySingleDedupeArgs,
) -> Result<ApplySingleDedupeResult, String> {
    let parent = registry::open_notify_icon_settings(false)?;
    let mut propagated = false;

    if let Some(value) = args.propagated_is_promoted {
        registry::set_is_promoted(&parent, &args.keep_subkey, value)?;
        propagated = true;
    }

    parent
        .delete_subkey_all(&args.drop_subkey)
        .map_err(|e| format!("Failed to delete drop subkey '{}': {}", args.drop_subkey, e))?;

    Ok(ApplySingleDedupeResult {
        keep_subkey: args.keep_subkey,
        drop_subkey: args.drop_subkey,
        propagated,
        dropped: true,
    })
}

#[cfg(not(windows))]
#[tauri::command]
pub async fn prepare_tray_config_migration(
    _state: State<'_, AppState>,
    _args: TrayMigrationPrepareArgs,
) -> Result<TrayMigrationPrepareResult, String> {
    Err("This command is only available on Windows".to_string())
}

#[cfg(not(windows))]
#[tauri::command]
pub async fn finalize_tray_config_migration(
    _state: State<'_, AppState>,
    _args: TrayMigrationFinalizeArgs,
) -> Result<TrayMigrationFinalizeResult, String> {
    Err("This command is only available on Windows".to_string())
}

#[cfg(not(windows))]
#[tauri::command]
pub async fn discard_tray_config_migration(
    _args: TrayMigrationFinalizeArgs,
) -> Result<TrayMigrationDiscardResult, String> {
    Err("This command is only available on Windows".to_string())
}

#[cfg(not(windows))]
#[tauri::command]
pub fn preview_dedupe_notify_icon_settings(
    _state: State<'_, AppState>,
) -> Result<NotifyIconDedupeResult, String> {
    Err("This command is only available on Windows".to_string())
}

#[cfg(not(windows))]
#[tauri::command]
pub fn apply_dedupe_notify_icon_settings(
    _state: State<'_, AppState>,
) -> Result<NotifyIconDedupeResult, String> {
    Err("This command is only available on Windows".to_string())
}

#[cfg(not(windows))]
#[tauri::command]
pub fn apply_single_dedupe_notify_icon_pair(
    _args: ApplySingleDedupeArgs,
) -> Result<ApplySingleDedupeResult, String> {
    Err("This command is only available on Windows".to_string())
}
