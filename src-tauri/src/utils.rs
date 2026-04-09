use crate::commands::powershell;
use crate::commands::settings;
use once_cell::sync::Lazy;
use regex::Regex;
use serde_json::Value;
use std::collections::HashSet;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Runtime};
use url::Url;

#[derive(Debug, Clone)]
pub struct ScoopAppShortcut {
    pub name: String,
    pub display_name: String,
    pub shortcut_path: PathBuf,
    pub target_path: String,
    pub working_directory: String,
    pub icon_path: Option<String>,
}

#[derive(Debug, Clone)]
struct ScoopAppShortcutsCache {
    shortcuts_dir: PathBuf,
    dir_modified_ms: u128,
    shortcuts: Vec<ScoopAppShortcut>,
}

/// Checks if the application is installed via Scoop
pub fn is_scoop_installation() -> bool {
    // Development mode override with additional safety checks
    #[cfg(debug_assertions)]
    {
        if std::env::var("DEV").map(|v| v == "1").unwrap_or(false) {
            // Extra safety: only allow bypass in specific development scenarios
            if cfg!(feature = "dev-self-update") {
                log::warn!("⚠️  DEV=1 detected - BYPASSING Scoop installation check!");
                log::warn!(
                    "⚠️  This is a DEVELOPMENT-ONLY feature and should NEVER happen in production!"
                );
                return true;
            } else {
                log::warn!("⚠️  DEV=1 detected but dev-self-update feature not enabled, using normal check");
            }
        }
    }

    // Original detection logic
    if let Ok(exe_path) = env::current_exe() {
        let path_str = exe_path.to_string_lossy().to_lowercase();
        let is_scoop =
            path_str.contains("scoop") && path_str.contains("apps") && path_str.contains("pailer");
        log::debug!(
            "Scoop installation check: path={}, result={}",
            exe_path.display(),
            is_scoop
        );
        is_scoop
    } else {
        log::warn!("Failed to get current executable path for Scoop installation check");
        false
    }
}

#[derive(Debug, Clone)]
struct ScoopRootCandidateInfo {
    path: PathBuf,
    has_apps_dir: bool,
    has_buckets_dir: bool,
}

fn push_candidate(seen: &mut HashSet<String>, candidates: &mut Vec<PathBuf>, path: PathBuf) {
    if path.as_os_str().is_empty() {
        return;
    }

    let key = path.to_string_lossy().to_lowercase();
    if seen.insert(key) {
        log::debug!("Adding candidate path: {}", path.display());
        candidates.push(path);
    }
}

fn collect_common_candidates(seen: &mut HashSet<String>, candidates: &mut Vec<PathBuf>) {
    log::info!("Collecting common Scoop path candidates");

    // Priority 1: Environment variables
    if let Ok(scoop_path) = env::var("SCOOP") {
        log::info!("Found SCOOP environment variable: {}", scoop_path);
        push_candidate(seen, candidates, PathBuf::from(scoop_path));
    }

    if let Ok(global_path) = env::var("SCOOP_GLOBAL") {
        log::info!("Found SCOOP_GLOBAL environment variable: {}", global_path);
        push_candidate(seen, candidates, PathBuf::from(global_path));
    }

    // Priority 2: Try to get scoop root from scoop command itself (most reliable)
    if let Ok(scoop_root) = get_scoop_root_from_command() {
        log::info!("Found scoop root from command: {}", scoop_root.display());
        push_candidate(seen, candidates, scoop_root);
    } else {
        // Priority 3: Common fallback paths
        log::info!("Using fallback detection");

        // User profile scoop installation
        if let Ok(user_profile) = env::var("USERPROFILE") {
            push_candidate(seen, candidates, PathBuf::from(user_profile).join("scoop"));
        }

        // Additional environment variables from old version
        if let (Ok(home_drive), Ok(home_path)) = (env::var("HOMEDRIVE"), env::var("HOMEPATH")) {
            let combined = format!("{}{}", home_drive.trim_end_matches('\\'), home_path);
            push_candidate(seen, candidates, PathBuf::from(combined).join("scoop"));
        }

        if let Ok(local_app_data) = env::var("LOCALAPPDATA") {
            push_candidate(
                seen,
                candidates,
                PathBuf::from(local_app_data).join("scoop"),
            );
        }

        // System-wide installation
        if let Ok(program_data) = env::var("PROGRAMDATA") {
            push_candidate(seen, candidates, PathBuf::from(program_data).join("scoop"));
        }

        // System drive dynamic detection
        if let Ok(system_drive) = env::var("SystemDrive") {
            let drive_root = system_drive.trim_end_matches('\\');
            push_candidate(
                seen,
                candidates,
                PathBuf::from(format!("{}\\scoop", drive_root)),
            );
        }

        // Common hardcoded paths
        push_candidate(seen, candidates, PathBuf::from(r"C:\scoop"));
        push_candidate(seen, candidates, PathBuf::from(r"C:\ProgramData\scoop"));
    }
}

fn collect_user_profile_candidates(seen: &mut HashSet<String>, candidates: &mut Vec<PathBuf>) {
    log::info!("Collecting user profile candidates");
    let mut roots = Vec::new();

    if let Ok(system_drive) = env::var("SystemDrive") {
        let mut drive_root = PathBuf::from(system_drive.trim_end_matches('\\'));
        drive_root.push("Users");
        roots.push(drive_root);
    }

    roots.push(PathBuf::from(r"C:\Users"));

    for root in roots {
        if !root.is_dir() {
            continue;
        }

        // Limit the number of user directories to scan for performance
        let mut user_count = 0;
        const MAX_USERS_TO_SCAN: usize = 10;

        if let Ok(entries) = fs::read_dir(&root) {
            for entry in entries.filter_map(Result::ok) {
                user_count += 1;
                if user_count > MAX_USERS_TO_SCAN {
                    log::info!(
                        "Stopping user directory scan after {} users for performance",
                        MAX_USERS_TO_SCAN
                    );
                    break;
                }

                let user_dir = entry.path();
                let scoop_dir = user_dir.join("scoop");
                if scoop_dir.is_dir() {
                    log::info!("Found user scoop directory: {}", scoop_dir.display());
                    push_candidate(seen, candidates, scoop_dir);
                }

                let local_scoop_dir = user_dir.join("AppData").join("Local").join("scoop");
                if local_scoop_dir.is_dir() {
                    log::info!(
                        "Found local AppData scoop directory: {}",
                        local_scoop_dir.display()
                    );
                    push_candidate(seen, candidates, local_scoop_dir);
                }
            }
        }
    }
}

pub fn build_candidate_list<I>(extras: I) -> Vec<PathBuf>
where
    I: IntoIterator<Item = PathBuf>,
{
    log::info!("Building candidate list");
    let mut seen = HashSet::new();
    let mut candidates = Vec::new();

    for path in extras {
        log::info!("Adding extra path to candidates: {}", path.display());
        push_candidate(&mut seen, &mut candidates, path);
    }

    collect_common_candidates(&mut seen, &mut candidates);
    collect_user_profile_candidates(&mut seen, &mut candidates);

    log::info!("Built candidate list with {} paths", candidates.len());
    for (i, candidate) in candidates.iter().enumerate() {
        log::debug!("Candidate {}: {}", i, candidate.display());
    }

    candidates
}

#[allow(dead_code)]
fn evaluate_scoop_candidate(path: PathBuf) -> Option<ScoopRootCandidateInfo> {
    log::debug!("Evaluating Scoop candidate: {}", path.display());

    if !path.is_dir() {
        log::debug!("Skipping invalid candidate: {}", path.display());
        return None;
    }

    let apps_dir = path.join("apps");
    let buckets_dir = path.join("buckets");
    let has_apps_dir = apps_dir.is_dir();
    let has_buckets_dir = buckets_dir.is_dir();

    if !has_apps_dir && !has_buckets_dir {
        log::debug!("Candidate rejected - missing both apps and buckets directories");
        return None;
    }

    let installed_count = if has_apps_dir {
        match fs::read_dir(&apps_dir) {
            Ok(entries) => {
                let count = entries
                    .filter_map(Result::ok)
                    .filter(|entry| entry.path().is_dir())
                    .take(200)
                    .count();
                log::debug!("Found {} installed apps in apps directory", count);
                count
            }
            Err(e) => {
                log::warn!("Failed to read apps directory: {}", e);
                0
            }
        }
    } else {
        0
    };

    log::debug!(
        "Valid Scoop root candidate: {} (apps_dir={}, buckets_dir={}, installed={})",
        path.display(),
        has_apps_dir,
        has_buckets_dir,
        installed_count
    );

    Some(ScoopRootCandidateInfo {
        path,
        has_apps_dir,
        has_buckets_dir,
    })
}

#[allow(dead_code)]
fn select_best_scoop_root(
    candidates: Vec<PathBuf>,
    preferred: Option<&PathBuf>,
) -> Option<ScoopRootCandidateInfo> {
    log::debug!(
        "Selecting best Scoop root from {} candidates",
        candidates.len()
    );

    // Use preferred path if available
    if let Some(preferred_path) = preferred {
        if let Some(candidate) = candidates.iter().find(|path| **path == *preferred_path) {
            if let Some(info) = evaluate_scoop_candidate(candidate.clone()) {
                log::info!("Using preferred Scoop root: {}", preferred_path.display());
                return Some(info);
            }
        }
    }

    // Collect all valid candidates
    let mut valid_candidates: Vec<ScoopRootCandidateInfo> = candidates
        .into_iter()
        .filter_map(|candidate| evaluate_scoop_candidate(candidate))
        .collect();

    // Sort by priority: has apps+buckets > has apps > has buckets
    valid_candidates.sort_by(|a, b| {
        let a_priority = (a.has_apps_dir, a.has_buckets_dir);
        let b_priority = (b.has_apps_dir, b.has_buckets_dir);
        b_priority.cmp(&a_priority)
    });

    if let Some(best) = valid_candidates.into_iter().next() {
        let selection_type = if best.has_apps_dir && best.has_buckets_dir {
            "with apps and buckets"
        } else if best.has_apps_dir {
            "with apps directory"
        } else {
            "with buckets directory"
        };

        log::info!(
            "Selected Scoop root {}: {}",
            selection_type,
            best.path.display()
        );
        Some(best)
    } else {
        log::warn!("No valid Scoop root found");
        None
    }
}

/// Resolve the root directory of Scoop on the host machine.
///
/// The resolver inspects the persisted setting first, then scores a set of
/// likely directories (environment variables, known install paths, user
/// profiles) by checking for Scoop buckets and installed apps. The best match
/// is remembered for future runs so MSI/Elevated launches still find the
/// user's Scoop data.
///
/// # Errors
/// Returns Err when no Scoop path is configured.
/// This function no longer auto-detects paths - it only uses the configured path.
pub fn resolve_scoop_root<R: Runtime>(app: AppHandle<R>) -> Result<PathBuf, String> {
    log::info!("Resolving Scoop root directory");

    let stored_path = settings::get_scoop_path(app.clone())
        .ok()
        .flatten()
        .map(PathBuf::from);

    if let Some(path) = stored_path.as_ref() {
        log::info!("Using configured Scoop path: {}", path.display());
        return Ok(path.clone());
    } else {
        log::warn!("No Scoop path configured in settings");
        return Err("No Scoop path configured. Please configure it in settings.".to_string());
    }
}

// -----------------------------------------------------------------------------
// Manifest helpers
// -----------------------------------------------------------------------------

/// Locate a manifest file for `package_name` within the Scoop buckets.
///
/// If `package_source` is supplied it will be treated as an exact bucket name
/// and only that bucket will be inspected. Otherwise all buckets are searched
/// in parallel and the first match is returned.
///
/// The returned tuple contains the fully qualified path to the manifest file
/// and the bucket name the manifest originated from.
///
/// # Errors
/// Propagates any I/O failure and returns a domain-specific error when the
/// manifest cannot be located.
pub fn locate_package_manifest(
    scoop_dir: &std::path::Path,
    package_name: &str,
    package_source: Option<String>,
) -> Result<(PathBuf, String), String> {
    locate_package_manifest_impl(scoop_dir, package_name, package_source)
}

fn is_install_version_directory(path: &std::path::Path) -> bool {
    path.join("manifest.json").exists() || path.join("install.json").exists()
}

fn find_latest_install_dir(package_dir: &std::path::Path) -> Option<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(entries) = std::fs::read_dir(package_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            if path
                .file_name()
                .and_then(|name| name.to_str())
                .map(|name| name.eq_ignore_ascii_case("current"))
                .unwrap_or(false)
            {
                continue;
            }

            if !is_install_version_directory(&path) {
                continue;
            }

            if let Ok(metadata) = std::fs::metadata(&path) {
                if let Ok(modified) = metadata.modified() {
                    candidates.push((modified, path));
                }
            }
        }
    }

    candidates.sort_by(|a, b| b.0.cmp(&a.0));
    candidates.into_iter().next().map(|(_, path)| path)
}

pub fn locate_current_install_dir(
    scoop_dir: &std::path::Path,
    package_name: &str,
) -> Result<PathBuf, String> {
    let package_dir = scoop_dir.join("apps").join(package_name);
    if !package_dir.exists() {
        return Err(format!("Package '{}' is not installed", package_name));
    }

    let current_path = package_dir.join("current");
    if current_path.exists() && current_path.is_dir() {
        return Ok(current_path);
    }

    find_latest_install_dir(&package_dir).ok_or_else(|| {
        format!(
            "Could not find installation directory for package '{}'",
            package_name
        )
    })
}

pub fn read_install_bucket_from_dir(dir: &std::path::Path) -> Option<String> {
    let install_path = dir.join("install.json");
    let content = std::fs::read_to_string(install_path).ok()?;
    let json: Value = serde_json::from_str(&content).ok()?;
    json.get("bucket")
        .and_then(|v| v.as_str())
        .map(|v| v.to_string())
}

pub fn get_installed_package_bucket(
    scoop_dir: &std::path::Path,
    package_name: &str,
) -> Option<String> {
    let install_dir = locate_current_install_dir(scoop_dir, package_name).ok()?;
    read_install_bucket_from_dir(&install_dir).filter(|bucket| !bucket.trim().is_empty())
}

#[cfg(test)]
mod utils_tests;

// Internal implementation that contains the previous logic. This avoids code
// duplication while giving us the opportunity to phase out the old API.
fn locate_package_manifest_impl(
    scoop_dir: &std::path::Path,
    package_name: &str,
    package_source: Option<String>,
) -> Result<(PathBuf, String), String> {
    let buckets_dir = scoop_dir.join("buckets");

    let search_buckets = |bucket_path: PathBuf| -> Result<(PathBuf, String), String> {
        if bucket_path.is_dir() {
            let bucket_name = bucket_path
                .file_name()
                .unwrap()
                .to_string_lossy()
                .to_string();

            let manifest_filename = format!("{}.json", package_name);

            let manifest_path = bucket_path.join(&manifest_filename);
            if manifest_path.exists() {
                return Ok((manifest_path, bucket_name));
            }

            let nested_manifest_path = bucket_path.join("bucket").join(&manifest_filename);
            if nested_manifest_path.exists() {
                return Ok((nested_manifest_path, bucket_name));
            }
        }
        Err(format!("Package '{}' not found.", package_name))
    };

    // 1. Try to find in specific bucket if provided
    if let Some(source) = &package_source {
        if !source.is_empty() && source != "None" && buckets_dir.is_dir() {
            let specific_bucket_path = buckets_dir.join(source);
            if let Ok(found) = search_buckets(specific_bucket_path) {
                return Ok(found);
            }

            return Err(format!(
                "Package '{}' not found in bucket '{}'.",
                package_name, source
            ));
        }
    }

    // 2. Search all buckets
    if buckets_dir.is_dir() {
        if let Ok(entries) = std::fs::read_dir(&buckets_dir) {
            for entry in entries.flatten() {
                if let Ok(found) = search_buckets(entry.path()) {
                    return Ok(found);
                }
            }
        }
    }

    // 3. Check installed apps if not found in buckets
    let installed_manifest_path = scoop_dir
        .join("apps")
        .join(package_name)
        .join("current")
        .join("manifest.json");

    if installed_manifest_path.exists() {
        // Try to read install.json to get the original bucket name if possible
        let install_json_path = scoop_dir
            .join("apps")
            .join(package_name)
            .join("current")
            .join("install.json");

        let mut bucket_name = "Installed (Bucket missing)".to_string();

        if install_json_path.exists() {
            if let Ok(content) = std::fs::read_to_string(install_json_path) {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(bucket) = json.get("bucket").and_then(|b| b.as_str()) {
                        bucket_name = format!("{} (missing)", bucket);
                    }
                }
            }
        }

        return Ok((installed_manifest_path, bucket_name));
    }

    if let Some(source) = package_source {
        if !source.is_empty() && source != "None" {
            return Err(format!(
                "Package '{}' not found in bucket '{}'.",
                package_name, source
            ));
        }
    }

    Err(format!(
        "Package '{}' not found in any bucket.",
        package_name
    ))
}

// -----------------------------------------------------------------------------
// Scoop Apps Shortcuts helpers
// -----------------------------------------------------------------------------

/// Scans the Windows Start Menu for Scoop Apps shortcuts
///
/// Returns a list of shortcuts found in %AppData%\Microsoft\Windows\Start Menu\Programs\Scoop Apps
pub fn get_scoop_app_shortcuts_with_path(
    scoop_path: &std::path::Path,
) -> Result<Vec<ScoopAppShortcut>, String> {
    let app_data =
        env::var("APPDATA").map_err(|_| "Could not find APPDATA environment variable")?;
    let scoop_apps_path = PathBuf::from(app_data)
        .join("Microsoft")
        .join("Windows")
        .join("Start Menu")
        .join("Programs")
        .join("Scoop Apps");

    if !scoop_apps_path.exists() {
        log::debug!(
            "Scoop Apps directory not found: {}",
            scoop_apps_path.display()
        );
        return Ok(Vec::new());
    }

    if let Some(cached) = get_cached_scoop_app_shortcuts(&scoop_apps_path) {
        return Ok(cached);
    }

    let mut shortcuts = Vec::new();

    for entry in fs::read_dir(&scoop_apps_path)
        .map_err(|e| format!("Failed to read Scoop Apps directory: {}", e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("lnk") {
            if let Some(file_stem) = path.file_stem().and_then(|s| s.to_str()) {
                if let Ok(shortcut_info) = parse_shortcut(&path, scoop_path) {
                    let display_name = if file_stem.contains('_') {
                        file_stem.replace('_', " ")
                    } else {
                        file_stem.to_owned()
                    };

                    shortcuts.push(ScoopAppShortcut {
                        name: file_stem.to_string(),
                        display_name,
                        shortcut_path: path.clone(),
                        target_path: shortcut_info.target_path,
                        working_directory: shortcut_info.working_directory,
                        icon_path: shortcut_info.icon_path,
                    });
                } else {
                    log::trace!("Failed to parse shortcut: {}", path.display());
                }
            }
        }
    }

    if !shortcuts.is_empty() {
        log::debug!("Scoop Apps shortcuts detected: {}", shortcuts.len());
    }

    update_scoop_app_shortcuts_cache(&scoop_apps_path, &shortcuts);
    Ok(shortcuts)
}

/// Try to get scoop root by running scoop config command
fn get_scoop_root_from_command() -> Result<PathBuf, Box<dyn std::error::Error>> {
    use std::process::Command;

    log::info!("Attempting to get scoop root from command");

    let output = Command::new("scoop")
        .args(&["config", "root_path"])
        .output();

    match output {
        Ok(result) => {
            if result.status.success() {
                let scoop_path = String::from_utf8(result.stdout)?;
                let trimmed_path = scoop_path.trim();

                if !trimmed_path.is_empty() && PathBuf::from(trimmed_path).exists() {
                    log::info!("Found scoop root from command: {}", trimmed_path);
                    return Ok(PathBuf::from(trimmed_path));
                }
            } else {
                let stderr = String::from_utf8_lossy(&result.stderr);
                log::debug!("scoop config root_path failed: {}", stderr);
            }
        }
        Err(e) => {
            log::debug!("Failed to execute scoop command: {}", e);
        }
    }

    Err("Failed to get scoop root from command".into())
}

/// Legacy wrapper for backwards compatibility - tries to find Scoop root automatically
pub fn get_scoop_app_shortcuts() -> Result<Vec<ScoopAppShortcut>, String> {
    // Try to find Scoop root automatically for backwards compatibility
    let scoop_root = get_scoop_root_fallback();
    get_scoop_app_shortcuts_with_path(&scoop_root)
}

/// Check if a path is a valid Scoop candidate (has apps or buckets directory)
pub fn is_valid_scoop_candidate(path: &PathBuf) -> bool {
    if !path.exists() || !path.is_dir() {
        return false;
    }

    let apps_dir = path.join("apps");
    let buckets_dir = path.join("buckets");

    let has_apps = apps_dir.exists() && apps_dir.is_dir();
    let has_buckets = buckets_dir.exists() && buckets_dir.is_dir();

    // A valid scoop installation should have at least one of these directories
    has_apps || has_buckets
}

use std::sync::{Mutex, OnceLock};

// Global cache for Scoop root to avoid repeated detection
static SCOOP_ROOT_CACHE: OnceLock<Mutex<Option<PathBuf>>> = OnceLock::new();
static SCOOP_APP_SHORTCUTS_CACHE: OnceLock<Mutex<Option<ScoopAppShortcutsCache>>> = OnceLock::new();

fn get_path_modified_ms(path: &Path) -> u128 {
    fs::metadata(path)
        .and_then(|meta| meta.modified())
        .ok()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

fn get_cached_scoop_app_shortcuts(shortcuts_dir: &Path) -> Option<Vec<ScoopAppShortcut>> {
    let cache = SCOOP_APP_SHORTCUTS_CACHE.get_or_init(|| Mutex::new(None));
    let cache_guard = cache.lock().ok()?;
    let entry = cache_guard.as_ref()?;

    if entry.shortcuts_dir != shortcuts_dir {
        return None;
    }

    let current_modified_ms = get_path_modified_ms(shortcuts_dir);
    if current_modified_ms == entry.dir_modified_ms {
        log::trace!(
            "Reusing cached Scoop Apps shortcuts (count={})",
            entry.shortcuts.len()
        );
        return Some(entry.shortcuts.clone());
    }

    None
}

fn update_scoop_app_shortcuts_cache(shortcuts_dir: &Path, shortcuts: &[ScoopAppShortcut]) {
    let cache = SCOOP_APP_SHORTCUTS_CACHE.get_or_init(|| Mutex::new(None));
    if let Ok(mut cache_guard) = cache.lock() {
        *cache_guard = Some(ScoopAppShortcutsCache {
            shortcuts_dir: shortcuts_dir.to_path_buf(),
            dir_modified_ms: get_path_modified_ms(shortcuts_dir),
            shortcuts: shortcuts.to_vec(),
        });
    }
}

/// Get Scoop root directory as fallback when AppState is not available
pub fn get_scoop_root_fallback() -> PathBuf {
    // Try to get from cache first
    let cache = SCOOP_ROOT_CACHE.get_or_init(|| Mutex::new(None));

    // Check if we have a cached value
    {
        let cached_value = cache.lock().unwrap();
        if let Some(ref path) = *cached_value {
            log::debug!("Using cached Scoop root: {}", path.display());
            return path.clone();
        }
    }

    // Simple detection: check SCOOP env var first
    if let Ok(scoop_path) = env::var("SCOOP") {
        let path = PathBuf::from(&scoop_path);
        if path.join("apps").is_dir() {
            log::info!("Using SCOOP environment variable: {}", path.display());
            let mut cached_value = cache.lock().unwrap();
            *cached_value = Some(path.clone());
            return path;
        }
    }

    // Fallback to common paths
    let mut common_paths = vec![
        PathBuf::from(r"C:\ProgramData\scoop"),
        PathBuf::from(r"C:\scoop"),
    ];

    // Add user profile scoop path dynamically
    if let Ok(user_profile) = env::var("USERPROFILE") {
        common_paths.insert(0, PathBuf::from(user_profile).join("scoop"));
    }

    for path in common_paths {
        if path.join("apps").is_dir() {
            log::info!("Found Scoop at: {}", path.display());
            let mut cached_value = cache.lock().unwrap();
            *cached_value = Some(path.clone());
            return path;
        }
    }

    // Default fallback
    let default_path = PathBuf::from("C:\\scoop");
    log::warn!("Using default Scoop path: {}", default_path.display());

    let mut cached_value = cache.lock().unwrap();
    *cached_value = Some(default_path.clone());

    default_path
}

/// Clear the Scoop root cache (useful when Scoop configuration changes)
pub fn clear_scoop_root_cache() {
    if let Some(cache) = SCOOP_ROOT_CACHE.get() {
        let mut cached_value = cache.lock().unwrap();
        *cached_value = None;
        log::info!("Scoop root cache cleared");
    }
}

#[derive(Debug)]
struct ShortcutInfo {
    target_path: String,
    working_directory: String,
    icon_path: Option<String>,
}

/// Parse a Windows .lnk shortcut file to extract target and working directory
/// Uses the lnk crate to parse LNK files directly
/// Verbose byte-level output from the lnk crate is gated behind TRACE level
#[cfg(windows)]
fn parse_shortcut(path: &PathBuf, _scoop_root: &std::path::Path) -> Result<ShortcutInfo, String> {
    // Use the lnk crate to parse the shortcut file
    match lnk::ShellLink::open(path, lnk::encoding::WINDOWS_1252) {
        Ok(shortcut) => {
            // Extract target path - try different methods to get the target
            let mut target_path = {
                let string_data = shortcut.string_data();
                // Try relative path first
                if let Some(relative_path) = string_data.relative_path() {
                    relative_path.to_string()
                } else {
                    String::new()
                }
            };

            // If target path is still empty, try to get it from link info
            if target_path.is_empty() {
                if let Some(link_info) = shortcut.link_info() {
                    if let Some(local_path) = link_info.local_base_path() {
                        target_path = local_path.to_string();
                    }
                }
            }

            // Convert relative path to absolute path if needed
            if !target_path.is_empty() && target_path.starts_with("..") {
                // The relative path is relative to the shortcut's directory
                if let Some(shortcut_dir) = path.parent() {
                    let absolute_path = shortcut_dir.join(&target_path);
                    if let Ok(canonical_path) = absolute_path.canonicalize() {
                        target_path = canonical_path.to_string_lossy().to_string();
                        log::trace!("Resolved relative path to: {}", target_path);
                    } else {
                        log::warn!("Failed to canonicalize path: {}", absolute_path.display());
                    }
                }
            }

            // Extract working directory
            let working_directory = {
                let string_data = shortcut.string_data();
                if let Some(working_dir) = string_data.working_dir() {
                    working_dir.to_string()
                } else {
                    String::new()
                }
            };

            // If no working directory specified, use target path's parent directory
            let working_directory = if working_directory.is_empty() && !target_path.is_empty() {
                if let Some(parent) = std::path::Path::new(&target_path).parent() {
                    parent.to_string_lossy().to_string()
                } else {
                    env::var("USERPROFILE").unwrap_or_else(|_| "C:\\".to_string())
                }
            } else if working_directory.is_empty() {
                env::var("USERPROFILE").unwrap_or_else(|_| "C:\\".to_string())
            } else {
                working_directory
            };

            // Extract icon location if available
            let icon_path = {
                let string_data = shortcut.string_data();
                string_data.icon_location().as_ref().map(|s| s.to_string())
            };

            Ok(ShortcutInfo {
                target_path,
                working_directory,
                icon_path,
            })
        }
        Err(e) => {
            log::trace!("Failed to parse LNK file: {}", e);

            // Return error instead of fallback for cleaner error handling
            Err(format!("Failed to parse LNK file: {}", e))
        }
    }
}

#[cfg(not(windows))]
fn parse_shortcut(_path: &PathBuf, _scoop_root: &std::path::Path) -> Result<ShortcutInfo, String> {
    Err("Shortcut parsing is only supported on Windows".to_string())
}

/// Emit a Scoop app using its target path
pub fn launch_scoop_app(target_path: &str, working_directory: &str) -> Result<(), String> {
    log::info!(
        "Launching app: '{}' from '{}'",
        target_path,
        working_directory
    );

    // Validate that we have a target path
    if target_path.is_empty() {
        return Err("No target path specified for app launch".to_string());
    }

    // Check if the target path exists
    if !std::path::Path::new(target_path).exists() {
        return Err(format!("Target executable not found: {}", target_path));
    }

    use std::process::Command;

    let mut cmd = Command::new(target_path);

    // Set working directory if provided and valid
    if !working_directory.is_empty() {
        let working_dir_path = std::path::Path::new(working_directory);
        if working_dir_path.exists() {
            cmd.current_dir(working_directory);
        } else {
            log::warn!(
                "Working directory does not exist: {}, using default",
                working_directory
            );
        }
    }

    // Detach the process so it doesn't block
    match cmd.spawn() {
        Ok(_) => {
            log::info!("Successfully launched app: {}", target_path);
            Ok(())
        }
        Err(e) => {
            let error_msg = format!("Failed to launch app '{}': {}", target_path, e);
            log::error!("{}", error_msg);
            Err(error_msg)
        }
    }
}

/// Counts the number of manifest (.json) files in a bucket directory.
/// Handles both flat structure and bucket/ subdirectory structure.
pub fn count_manifests(bucket_path: &std::path::Path) -> u32 {
    let mut count = 0;

    // Check for manifests in the root of the bucket
    if let Ok(entries) = fs::read_dir(bucket_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
                // Skip certain files that aren't package manifests
                if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                    if !file_name.starts_with('.') && file_name != "bucket.json" {
                        count += 1;
                    }
                }
            }
        }
    }

    // Always check the bucket/ subdirectory as well (many buckets primarily use this structure)
    let bucket_subdir = bucket_path.join("bucket");
    if bucket_subdir.is_dir() {
        if let Ok(entries) = fs::read_dir(bucket_subdir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
                    count += 1;
                }
            }
        }
    }

    count
}

// -----------------------------------------------------------------------------
// URL and Bucket Helpers
// -----------------------------------------------------------------------------

// Regex to validate and normalize Git URLs
static GIT_URL_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^(?:https?://)?(?:www\.)?(?:github\.com|gitlab\.com|bitbucket\.org)/([^/]+)/([^/]+?)(?:\.git)?/?$").unwrap()
});

/// Validate and normalize repository URL
pub fn validate_and_normalize_url(url: &str) -> Result<String, String> {
    // Handle common URL formats
    let normalized_url = if url.starts_with("http://") || url.starts_with("https://") {
        url.to_string()
    } else if url.contains("github.com")
        || url.contains("gitlab.com")
        || url.contains("bitbucket.org")
    {
        if url.starts_with("git@") {
            // Convert SSH format to HTTPS
            if let Some(captures) = Regex::new(r"git@([^:]+):([^/]+)/(.+?)(?:\.git)?$")
                .unwrap()
                .captures(url)
            {
                let host = &captures[1];
                let user = &captures[2];
                let repo = &captures[3];
                format!("https://{}/{}/{}.git", host, user, repo)
            } else {
                return Err("Invalid SSH Git URL format".to_string());
            }
        } else {
            // Assume it's a GitHub shorthand like "user/repo"
            if url.split('/').count() == 2 && !url.contains('.') {
                format!("https://github.com/{}.git", url)
            } else {
                format!("https://{}", url.trim_start_matches("www."))
            }
        }
    } else if url.split('/').count() == 2 && !url.contains('.') {
        // Handle GitHub shorthand "user/repo"
        format!("https://github.com/{}.git", url)
    } else {
        return Err(
            "URL must be a valid Git repository (GitHub, GitLab, or Bitbucket)".to_string(),
        );
    };

    // Ensure .git extension for consistency
    let final_url = if !normalized_url.ends_with(".git")
        && (normalized_url.contains("github.com")
            || normalized_url.contains("gitlab.com")
            || normalized_url.contains("bitbucket.org"))
    {
        format!("{}.git", normalized_url)
    } else {
        normalized_url
    };

    // Validate URL format
    match Url::parse(&final_url) {
        Ok(_) => Ok(final_url),
        Err(_) => Err("Invalid URL format".to_string()),
    }
}

/// Extract bucket name from URL or use provided name
pub fn extract_bucket_name_from_url(
    url: &str,
    provided_name: Option<&str>,
) -> Result<String, String> {
    if let Some(name) = provided_name {
        if !name.is_empty() {
            return Ok(name.to_lowercase().trim().to_string());
        }
    }

    // Try to extract from URL
    if let Some(captures) = GIT_URL_REGEX.captures(url) {
        let repo_name = captures.get(2).unwrap().as_str();
        // Remove common prefixes and clean up
        let clean_name = repo_name
            .replace("scoop-", "")
            .replace("Scoop-", "")
            .replace("scoop_", "")
            .to_lowercase();

        if clean_name.is_empty() {
            return Err("Could not extract valid bucket name from URL".to_string());
        }

        Ok(clean_name)
    } else {
        Err("Could not extract bucket name from URL. Please provide a name.".to_string())
    }
}

/// Execute a custom command with operation tracking
#[tauri::command]
pub async fn execute_custom_command(
    window: tauri::Window,
    command: String,
    operation_id: String,
) -> Result<(), String> {
    if !cfg!(debug_assertions) {
        return Err("Custom command execution is only available in debug builds".to_string());
    }

    log::info!("[{}] Executing custom command: {}", operation_id, command);

    // Create operation name before moving command
    let operation_name = format!("Custom Command: {}", command);

    // Use the existing PowerShell execution system
    powershell::run_and_stream_command(
        window,
        command,
        operation_name,
        powershell::EVENT_OUTPUT,
        powershell::EVENT_FINISHED,
        powershell::EVENT_CANCEL,
        operation_id,
    )
    .await
}
