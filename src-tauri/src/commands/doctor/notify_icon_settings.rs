use crate::state::AppState;
use lazy_static::lazy_static;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;
use tokio::sync::Mutex;

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
struct TrayMigrationSnapshot {
    operation_type: String,
    preserve_versioned_installs: bool,
    created_at_secs: u64,
    records: Vec<TrayMigrationRecord>,
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
    pub skipped_versioned: usize,
    pub failed: Vec<String>,
}

#[derive(Serialize, Debug)]
pub struct TrayMigrationDiscardResult {
    pub operation_id: String,
    pub discarded: bool,
}

lazy_static! {
    static ref TRAY_MIGRATION_SNAPSHOTS: Mutex<HashMap<String, TrayMigrationSnapshot>> =
        Mutex::new(HashMap::new());
}

#[cfg(windows)]
const TRAY_MIGRATION_SNAPSHOT_TTL_SECS: u64 = 60 * 60;

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
    map.retain(|_, snapshot| now.saturating_sub(snapshot.created_at_secs) <= TRAY_MIGRATION_SNAPSHOT_TTL_SECS);
    before.saturating_sub(map.len())
}

#[cfg(windows)]
#[derive(Clone, Debug)]
struct NotifyIconEntry {
    subkey: String,
    path: String,
    path_norm: String,
    promoted: Option<u32>,
    app_user_model_id: Option<String>,
}

#[cfg(windows)]
fn looks_like_filesystem_path(value: &str) -> bool {
    !(value.starts_with("::") || value.contains("::{") || value.starts_with("shell:"))
}

#[cfg(windows)]
fn normalize_executable_path(value: &str) -> Option<String> {
    let trimmed = value.trim().trim_matches('"').trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(trimmed.to_string())
}

#[cfg(windows)]
fn normalize_aumid(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(trimmed.to_ascii_lowercase())
}

#[cfg(windows)]
fn read_app_user_model_id(subkey: &winreg::RegKey) -> Option<String> {
    subkey
        .get_value::<String, _>("AppUserModelID")
        .ok()
        .and_then(|v| normalize_aumid(&v))
        .or_else(|| {
            subkey
                .get_value::<String, _>("AppUserModelId")
                .ok()
                .and_then(|v| normalize_aumid(&v))
        })
}

#[cfg(windows)]
fn to_normcase_path(path: &str) -> String {
    let mut p = path.replace('/', "\\");
    if let Some(stripped) = p.strip_prefix(r"\\?\UNC\") {
        p = format!(r"\\{}", stripped);
    } else if let Some(stripped) = p.strip_prefix(r"\\?\") {
        p = stripped.to_string();
    }
    while p.ends_with('\\') && p.len() > 3 {
        p.pop();
    }
    p.to_lowercase()
}

#[cfg(windows)]
fn build_scoop_prefixes(scoop_root: &std::path::Path) -> Vec<String> {
    vec![
        to_normcase_path(&scoop_root.join("apps").to_string_lossy()),
        to_normcase_path(&scoop_root.join("global").join("apps").to_string_lossy()),
    ]
}

#[cfg(windows)]
fn is_scoop_related_path(path: &str, prefixes: &[String]) -> bool {
    let normalized = to_normcase_path(path);
    prefixes.iter().any(|prefix| normalized.starts_with(prefix))
}

#[cfg(windows)]
fn logical_identity(path_norm: &str, prefixes: &[String]) -> Option<String> {
    use std::path::Path;

    let matched_prefix = prefixes
        .iter()
        .find(|prefix| path_norm.starts_with(prefix.as_str()))?;
    let scope = if matched_prefix.ends_with("\\global\\apps") {
        "global"
    } else {
        "local"
    };

    let relative = path_norm
        .strip_prefix(matched_prefix)?
        .trim_start_matches('\\');
    let mut parts = relative.split('\\');
    let pkg = parts.next()?;
    let _version = parts.next()?;
    let exe = Path::new(path_norm)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())?;

    Some(format!("{scope}:{pkg}:{exe}"))
}

#[cfg(windows)]
fn extract_package_name(path_norm: &str, prefixes: &[String]) -> Option<String> {
    let matched_prefix = prefixes
        .iter()
        .find(|prefix| path_norm.starts_with(prefix.as_str()))?;
    let relative = path_norm
        .strip_prefix(matched_prefix)?
        .trim_start_matches('\\');
    relative.split('\\').next().map(|s| s.to_string())
}

#[cfg(windows)]
fn resolve_current_target_for_path(path_norm: &str, prefixes: &[String]) -> Option<String> {
    use std::path::{Path, PathBuf};

    let matched_prefix = prefixes
        .iter()
        .find(|prefix| path_norm.starts_with(prefix.as_str()))?;
    let relative = path_norm
        .strip_prefix(matched_prefix)?
        .trim_start_matches('\\');
    let mut parts = relative.split('\\');
    let pkg = parts.next()?;
    let _version = parts.next()?;
    let rest: Vec<&str> = parts.collect();

    let current_base = Path::new(matched_prefix).join(pkg).join("current");
    let mut full = PathBuf::from(current_base);
    for seg in rest {
        full = full.join(seg);
    }

    full.canonicalize()
        .ok()
        .map(|p| to_normcase_path(&p.to_string_lossy()))
}

#[cfg(windows)]
fn resolve_current_target_original_path(path_norm: &str, prefixes: &[String]) -> Option<String> {
    use std::path::{Path, PathBuf};

    let matched_prefix = prefixes
        .iter()
        .find(|prefix| path_norm.starts_with(prefix.as_str()))?;
    let relative = path_norm
        .strip_prefix(matched_prefix)?
        .trim_start_matches('\\');
    let mut parts = relative.split('\\');
    let pkg = parts.next()?;
    let _version = parts.next()?;
    let rest: Vec<&str> = parts.collect();

    let current_base = Path::new(matched_prefix).join(pkg).join("current");
    let mut full = PathBuf::from(current_base);
    for seg in rest {
        full = full.join(seg);
    }

    full.canonicalize().ok().map(|p| {
        let mut s = p.to_string_lossy().replace('/', "\\");
        if let Some(stripped) = s.strip_prefix(r"\\?\UNC\") {
            s = format!(r"\\{}", stripped);
        } else if let Some(stripped) = s.strip_prefix(r"\\?\") {
            s = stripped.to_string();
        }
        while s.ends_with('\\') && s.len() > 3 {
            s.pop();
        }
        s
    })
}

#[cfg(windows)]
fn is_versioned_install_package(
    scoop_root: &std::path::Path,
    package_name: &str,
    is_global_scope: bool,
) -> bool {
    use std::fs;

    let package_dir = if is_global_scope {
        scoop_root.join("global").join("apps").join(package_name)
    } else {
        scoop_root.join("apps").join(package_name)
    };
    let install_json_path = package_dir.join("current").join("install.json");
    let Ok(raw) = fs::read_to_string(&install_json_path) else {
        return false;
    };
    let Ok(json) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return false;
    };
    json.get("bucket")
        .and_then(|b| b.as_str())
        .map(|b| b.eq_ignore_ascii_case("versions"))
        .unwrap_or(false)
}

#[cfg(windows)]
fn collect_scoop_notify_entries(
    parent: &winreg::RegKey,
    prefixes: &[String],
) -> (Vec<NotifyIconEntry>, Vec<String>) {
    use winreg::enums::*;
    let mut entries = Vec::new();
    let mut failed = Vec::new();

    for subkey_name in parent.enum_keys().flatten() {
        let subkey = match parent.open_subkey_with_flags(&subkey_name, KEY_READ) {
            Ok(key) => key,
            Err(e) => {
                failed.push(format!("{} (open failed: {})", subkey_name, e));
                continue;
            }
        };

        let executable_path: String = match subkey.get_value("ExecutablePath") {
            Ok(v) => v,
            Err(_) => continue,
        };
        let Some(path) = normalize_executable_path(&executable_path) else {
            continue;
        };
        if !looks_like_filesystem_path(&path) || !is_scoop_related_path(&path, prefixes) {
            continue;
        }

        entries.push(NotifyIconEntry {
            subkey: subkey_name,
            path_norm: to_normcase_path(&path),
            path,
            promoted: subkey.get_value::<u32, _>("IsPromoted").ok(),
            app_user_model_id: read_app_user_model_id(&subkey),
        });
    }

    (entries, failed)
}

#[cfg(windows)]
fn has_stable_group_aumid(group_entries: &[NotifyIconEntry]) -> bool {
    let mut seen: Option<&str> = None;
    for aumid in group_entries
        .iter()
        .filter_map(|entry| entry.app_user_model_id.as_deref())
    {
        match seen {
            None => seen = Some(aumid),
            Some(s) if s == aumid => {}
            Some(_) => return false,
        }
    }
    seen.is_some()
}

#[cfg(windows)]
fn run_notify_icon_dedupe(
    dry_run: bool,
    prefixes: &[String],
) -> Result<NotifyIconDedupeResult, String> {
    use winreg::{enums::*, RegKey};

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let key_path = r"Control Panel\NotifyIconSettings";
    let flags = if dry_run {
        KEY_READ
    } else {
        KEY_READ | KEY_WRITE
    };
    let parent = hkcu
        .open_subkey_with_flags(key_path, flags)
        .map_err(|e| format!("Failed to open registry path '{}': {}", key_path, e))?;

    let (entries, mut failed) = collect_scoop_notify_entries(&parent, prefixes);

    if cfg!(debug_assertions) {
        log::debug!(
            "[notify_icon_settings][dedupe] start: entries={}, prefixes={:?}",
            entries.len(),
            prefixes
        );
    }

    let mut groups: HashMap<String, Vec<NotifyIconEntry>> = HashMap::new();
    for entry in entries {
        let Some(id) = logical_identity(&entry.path_norm, prefixes) else {
            continue;
        };
        groups.entry(id).or_default().push(entry);
    }

    let mut pairs = Vec::new();
    for (identity, group_entries) in groups {
        if group_entries.len() < 2 {
            continue;
        }
        if has_stable_group_aumid(&group_entries) {
            if cfg!(debug_assertions) {
                log::debug!(
                    "[notify_icon_settings][dedupe] skip identity={} reason=stable_aumid",
                    identity
                );
            }
            continue;
        }

        let mut keep_idx = None;
        for (idx, e) in group_entries.iter().enumerate() {
            if let Some(current_target) = resolve_current_target_for_path(&e.path_norm, prefixes) {
                if current_target == e.path_norm {
                    keep_idx = Some(idx);
                    break;
                }
            }
        }

        let Some(keep_idx) = keep_idx else {
            continue;
        };
        let keep = &group_entries[keep_idx];
        let fallback_promoted = group_entries
            .iter()
            .enumerate()
            .filter(|(i, _)| *i != keep_idx)
            .find_map(|(_, e)| e.promoted);
        let propagated = if keep.promoted.is_none() {
            fallback_promoted
        } else {
            None
        };

        for (i, drop) in group_entries.iter().enumerate() {
            if i == keep_idx {
                continue;
            }
            pairs.push(NotifyIconDedupePair {
                identity: identity.clone(),
                keep_subkey: keep.subkey.clone(),
                keep_path: keep.path.clone(),
                drop_subkey: drop.subkey.clone(),
                drop_path: drop.path.clone(),
                propagated_is_promoted: propagated,
            });
        }
    }

    let mut deduped = 0usize;
    let mut dropped = 0usize;
    let mut propagated_count = 0usize;

    if !dry_run {
        let mut propagated_once: HashMap<String, bool> = HashMap::new();
        let mut deduped_identities: HashSet<String> = HashSet::new();
        for pair in &pairs {
            if let Some(v) = pair.propagated_is_promoted {
                if !propagated_once
                    .get(&pair.keep_subkey)
                    .copied()
                    .unwrap_or(false)
                {
                    match parent.open_subkey_with_flags(&pair.keep_subkey, KEY_WRITE) {
                        Ok(k) => {
                            if k.set_value("IsPromoted", &v).is_ok() {
                                propagated_count += 1;
                                propagated_once.insert(pair.keep_subkey.clone(), true);
                            }
                        }
                        Err(e) => failed.push(format!(
                            "{} (open keep failed while propagating IsPromoted: {})",
                            pair.keep_subkey, e
                        )),
                    }
                }
            }

            match parent.delete_subkey_all(&pair.drop_subkey) {
                Ok(_) => {
                    deduped_identities.insert(pair.identity.clone());
                    dropped += 1;
                }
                Err(e) => failed.push(format!(
                    "{} (delete duplicate failed: {})",
                    pair.drop_subkey, e
                )),
            }
        }
        deduped = deduped_identities.len();
    }

    Ok(NotifyIconDedupeResult {
        candidates: pairs.len(),
        deduped,
        dropped,
        propagated: propagated_count,
        failed,
        pairs,
    })
}

#[cfg(windows)]
#[tauri::command]
pub async fn prepare_tray_config_migration(
    state: State<'_, AppState>,
    args: TrayMigrationPrepareArgs,
) -> Result<TrayMigrationPrepareResult, String> {
    use winreg::{enums::*, RegKey};

    let scoop_root = state.scoop_path();
    let prefixes = build_scoop_prefixes(&scoop_root);
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let key_path = r"Control Panel\NotifyIconSettings";
    let parent = hkcu
        .open_subkey_with_flags(key_path, KEY_READ)
        .map_err(|e| format!("Failed to open registry path '{}': {}", key_path, e))?;
    let (entries, _failed) = collect_scoop_notify_entries(&parent, &prefixes);

    let target_package = args
        .package_name
        .as_ref()
        .filter(|p| !p.is_empty() && *p != "all-packages")
        .cloned();

    let mut records = Vec::new();
    for entry in entries {
        let Some(package_name) = extract_package_name(&entry.path_norm, &prefixes) else {
            continue;
        };
        if let Some(tp) = &target_package {
            if &package_name != tp {
                continue;
            }
        }
        let Some(identity) = logical_identity(&entry.path_norm, &prefixes) else {
            continue;
        };
        records.push(TrayMigrationRecord {
            package_name,
            identity,
            subkey: entry.subkey,
            executable_path: entry.path,
            promoted: entry.promoted,
        });
    }

    let package_count = records
        .iter()
        .map(|r| r.package_name.clone())
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
            preserve_versioned_installs: args.preserve_versioned_installs.unwrap_or(true),
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
#[tauri::command]
pub async fn finalize_tray_config_migration(
    state: State<'_, AppState>,
    args: TrayMigrationFinalizeArgs,
) -> Result<TrayMigrationFinalizeResult, String> {
    use winreg::{enums::*, RegKey};

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
            skipped_versioned: 0,
            failed: Vec::new(),
        });
    };

    let scoop_root = state.scoop_path();
    let prefixes = build_scoop_prefixes(&scoop_root);
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let key_path = r"Control Panel\NotifyIconSettings";
    let parent = hkcu
        .open_subkey_with_flags(key_path, KEY_READ | KEY_WRITE)
        .map_err(|e| format!("Failed to open registry path '{}': {}", key_path, e))?;
    let (entries, mut failed) = collect_scoop_notify_entries(&parent, &prefixes);

    let mut by_identity: HashMap<String, Vec<NotifyIconEntry>> = HashMap::new();
    for e in entries {
        if let Some(id) = logical_identity(&e.path_norm, &prefixes) {
            by_identity.entry(id).or_default().push(e);
        }
    }

    let mut rewritten_paths = 0usize;
    let mut propagated_is_promoted = 0usize;
    let mut removed_duplicates = 0usize;
    let mut skipped_versioned = 0usize;
    let mut processed_identities: HashSet<String> = HashSet::new();

    for rec in &snapshot.records {
        if !processed_identities.insert(rec.identity.clone()) {
            continue;
        }
        let Some(group) = by_identity.get(&rec.identity) else {
            continue;
        };
        if has_stable_group_aumid(group) {
            if cfg!(debug_assertions) {
                log::debug!(
                    "[tray-migration] skip identity={} reason=stable_aumid",
                    rec.identity
                );
            }
            continue;
        }
        let Some(any_entry) = group.first() else {
            continue;
        };
        let current_target_norm = resolve_current_target_for_path(&any_entry.path_norm, &prefixes);
        let Some(current_target_norm) = current_target_norm else {
            continue;
        };
        let current_target_raw = resolve_current_target_original_path(&any_entry.path_norm, &prefixes)
            .unwrap_or_else(|| any_entry.path.clone());

        // Keep current-entry if exists, otherwise keep the first live entry and rewrite its path.
        let keep_idx = group
            .iter()
            .position(|e| e.path_norm == current_target_norm)
            .unwrap_or(0);
        let keep_entry = &group[keep_idx];
        let identity_is_global = rec.identity.starts_with("global:");
        let fallback_promoted = group
            .iter()
            .enumerate()
            .filter(|(idx, _)| *idx != keep_idx)
            .find_map(|(_, e)| e.promoted)
            .or_else(|| {
                snapshot
                    .records
                    .iter()
                    .filter(|r| r.identity == rec.identity && r.subkey != keep_entry.subkey)
                    .find_map(|r| r.promoted)
            });

        if snapshot.preserve_versioned_installs
            && is_versioned_install_package(&scoop_root, &rec.package_name, identity_is_global)
        {
            skipped_versioned += 1;
            if keep_entry.promoted.is_none() {
                if let Some(v) = fallback_promoted {
                    match parent.open_subkey_with_flags(&keep_entry.subkey, KEY_WRITE) {
                        Ok(k) => {
                            if k.set_value("IsPromoted", &v).is_ok() {
                                propagated_is_promoted += 1;
                            }
                        }
                        Err(e) => failed.push(format!(
                            "{} (open keep failed while propagating IsPromoted: {})",
                            keep_entry.subkey, e
                        )),
                    }
                }
            }
            continue;
        }

        // Non-versioned:
        // 1) ensure keep entry points to current target
        // 2) propagate IsPromoted to keep entry when possible
        // 2) remove other duplicate entries
        if keep_entry.path_norm != current_target_norm {
            match parent.open_subkey_with_flags(&keep_entry.subkey, KEY_WRITE) {
                Ok(k) => {
                    if k.set_value("ExecutablePath", &current_target_raw).is_ok() {
                        rewritten_paths += 1;
                    } else {
                        failed.push(format!(
                            "{} (failed to rewrite keep ExecutablePath)",
                            keep_entry.subkey
                        ));
                    }
                }
                Err(e) => failed.push(format!(
                    "{} (open keep for path rewrite failed: {})",
                    keep_entry.subkey, e
                )),
            }
        }
        if keep_entry.promoted.is_none() {
            if let Some(v) = fallback_promoted {
                match parent.open_subkey_with_flags(&keep_entry.subkey, KEY_WRITE) {
                    Ok(k) => {
                        if k.set_value("IsPromoted", &v).is_ok() {
                            propagated_is_promoted += 1;
                        } else {
                            failed.push(format!(
                                "{} (failed to set IsPromoted on keep entry)",
                                keep_entry.subkey
                            ));
                        }
                    }
                    Err(e) => failed.push(format!(
                        "{} (open keep failed while propagating IsPromoted: {})",
                        keep_entry.subkey, e
                    )),
                }
            }
        }

        for (idx, e) in group.iter().enumerate() {
            if idx == keep_idx {
                continue;
            }
            if e.subkey == keep_entry.subkey {
                continue;
            }
            match parent.delete_subkey_all(&e.subkey) {
                Ok(_) => removed_duplicates += 1,
                Err(err) => failed.push(format!("{} (delete duplicate failed: {})", e.subkey, err)),
            }
        }
    }

    if cfg!(debug_assertions) {
        log::debug!(
            "[tray-migration] finalized op={} type={} rewritten={} propagated={} removed={} skipped_versioned={} failed={}",
            args.operation_id,
            snapshot.operation_type,
            rewritten_paths,
            propagated_is_promoted,
            removed_duplicates,
            skipped_versioned,
            failed.len()
        );
    }

    Ok(TrayMigrationFinalizeResult {
        operation_id: args.operation_id,
        rewritten_paths,
        propagated_is_promoted,
        removed_duplicates,
        skipped_versioned,
        failed,
    })
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
#[tauri::command]
pub fn preview_dedupe_notify_icon_settings(
    state: State<'_, AppState>,
) -> Result<NotifyIconDedupeResult, String> {
    let prefixes = build_scoop_prefixes(&state.scoop_path());
    run_notify_icon_dedupe(true, &prefixes)
}

#[cfg(windows)]
#[tauri::command]
pub fn apply_dedupe_notify_icon_settings(
    state: State<'_, AppState>,
) -> Result<NotifyIconDedupeResult, String> {
    let prefixes = build_scoop_prefixes(&state.scoop_path());
    run_notify_icon_dedupe(false, &prefixes)
}

#[cfg(windows)]
#[tauri::command]
pub fn apply_single_dedupe_notify_icon_pair(
    args: ApplySingleDedupeArgs,
) -> Result<ApplySingleDedupeResult, String> {
    use winreg::{enums::*, RegKey};

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let key_path = r"Control Panel\NotifyIconSettings";
    let parent = hkcu
        .open_subkey_with_flags(key_path, KEY_READ | KEY_WRITE)
        .map_err(|e| format!("Failed to open registry path '{}': {}", key_path, e))?;

    let mut propagated = false;
    if let Some(v) = args.propagated_is_promoted {
        let keep_key = parent
            .open_subkey_with_flags(&args.keep_subkey, KEY_WRITE)
            .map_err(|e| format!("Failed to open keep subkey '{}': {}", args.keep_subkey, e))?;
        keep_key
            .set_value("IsPromoted", &v)
            .map_err(|e| format!("Failed to set IsPromoted on '{}': {}", args.keep_subkey, e))?;
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
