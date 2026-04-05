use crate::state::AppState;
use serde::Serialize;
use tauri::State;

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

#[cfg(windows)]
#[derive(Clone, Debug)]
struct NotifyIconEntry {
    subkey: String,
    path: String,
    path_norm: String,
    promoted: Option<u32>,
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

    let relative = path_norm.strip_prefix(matched_prefix)?.trim_start_matches('\\');
    let mut parts = relative.split('\\');
    let pkg = parts.next()?;
    let _version = parts.next()?;
    let exe = Path::new(path_norm)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())?;

    Some(format!("{scope}:{pkg}:{exe}"))
}

#[cfg(windows)]
fn resolve_current_target_for_path(path_norm: &str, prefixes: &[String]) -> Option<String> {
    use std::path::{Path, PathBuf};

    let matched_prefix = prefixes
        .iter()
        .find(|prefix| path_norm.starts_with(prefix.as_str()))?;
    let relative = path_norm.strip_prefix(matched_prefix)?.trim_start_matches('\\');
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
        });
    }

    (entries, failed)
}

#[cfg(windows)]
fn run_notify_icon_dedupe(
    dry_run: bool,
    prefixes: &[String],
) -> Result<NotifyIconDedupeResult, String> {
    use std::collections::{HashMap, HashSet};
    use winreg::{enums::*, RegKey};

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let key_path = r"Control Panel\NotifyIconSettings";
    let flags = if dry_run { KEY_READ } else { KEY_READ | KEY_WRITE };
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
                if !propagated_once.get(&pair.keep_subkey).copied().unwrap_or(false) {
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
                Err(e) => failed.push(format!("{} (delete duplicate failed: {})", pair.drop_subkey, e)),
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
