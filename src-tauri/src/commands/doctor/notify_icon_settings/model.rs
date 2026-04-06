#[cfg(windows)]
#[derive(Clone, Debug)]
pub(super) struct NotifyIconEntry {
    pub subkey: String,
    pub path: String,
    pub path_norm: String,
    pub promoted: Option<u32>,
    pub app_user_model_id: Option<String>,
}

#[cfg(windows)]
pub(super) fn looks_like_filesystem_path(value: &str) -> bool {
    !(value.starts_with("::") || value.contains("::{") || value.starts_with("shell:"))
}

#[cfg(windows)]
pub(super) fn normalize_executable_path(value: &str) -> Option<String> {
    let trimmed = value.trim().trim_matches('"').trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(trimmed.to_string())
}

#[cfg(windows)]
pub(super) fn normalize_aumid(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(trimmed.to_ascii_lowercase())
}

#[cfg(windows)]
pub(super) fn to_normcase_path(path: &str) -> String {
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
pub(super) fn build_scoop_prefixes(scoop_root: &std::path::Path) -> Vec<String> {
    vec![
        to_normcase_path(&scoop_root.join("apps").to_string_lossy()),
        to_normcase_path(&scoop_root.join("global").join("apps").to_string_lossy()),
    ]
}

#[cfg(windows)]
pub(super) fn is_scoop_related_path(path: &str, prefixes: &[String]) -> bool {
    let normalized = to_normcase_path(path);
    prefixes.iter().any(|prefix| normalized.starts_with(prefix))
}

#[cfg(windows)]
pub(super) fn logical_identity(path_norm: &str, prefixes: &[String]) -> Option<String> {
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
pub(super) fn extract_package_name(path_norm: &str, prefixes: &[String]) -> Option<String> {
    let matched_prefix = prefixes
        .iter()
        .find(|prefix| path_norm.starts_with(prefix.as_str()))?;
    let relative = path_norm
        .strip_prefix(matched_prefix)?
        .trim_start_matches('\\');
    relative.split('\\').next().map(|s| s.to_string())
}

#[cfg(windows)]
fn resolve_current_target_pathbuf(
    path_norm: &str,
    prefixes: &[String],
) -> Option<std::path::PathBuf> {
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

    full.canonicalize().ok()
}

#[cfg(windows)]
pub(super) fn resolve_current_target_for_path(
    path_norm: &str,
    prefixes: &[String],
) -> Option<String> {
    resolve_current_target_pathbuf(path_norm, prefixes)
        .map(|path| to_normcase_path(&path.to_string_lossy()))
}

#[cfg(windows)]
pub(super) fn resolve_current_target_original_path(
    path_norm: &str,
    prefixes: &[String],
) -> Option<String> {
    resolve_current_target_pathbuf(path_norm, prefixes).map(|p| {
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
pub(super) fn has_multiple_installed_versions(
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
    fs::read_dir(&package_dir)
        .ok()
        .map(|entries| {
            entries
                .flatten()
                .filter(|entry| entry.path().is_dir())
                .filter_map(|entry| entry.file_name().to_str().map(|s| s.to_string()))
                .filter(|name| !name.eq_ignore_ascii_case("current"))
                .count()
                >= 2
        })
        .unwrap_or(false)
}

#[cfg(windows)]
pub(super) fn has_stable_group_aumid(group_entries: &[NotifyIconEntry]) -> bool {
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
