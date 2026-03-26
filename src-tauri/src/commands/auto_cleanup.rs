//! Commands for automatic cleanup based on user settings.
use crate::commands::installed::get_installed_packages_full;
use crate::commands::powershell;
use crate::commands::settings;
use crate::state::AppState;
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Runtime, State};

/// Settings for automatic cleanup operations.
#[derive(Debug, Deserialize)]
pub struct CleanupSettings {
    #[serde(rename = "autoCleanupEnabled")]
    pub auto_cleanup_enabled: bool,
    #[serde(rename = "cleanupOldVersions")]
    pub cleanup_old_versions: bool,
    #[serde(rename = "cleanupCache")]
    pub cleanup_cache: bool,
    #[serde(rename = "preserveVersionCount")]
    pub preserve_version_count: usize,
}

/// Runs the auto cleanup operation silently in the background based on user settings.
///
/// This function is designed to be called after package operations (install, update, uninstall)
/// to automatically clean up old versions and/or cache without user intervention.
#[tauri::command]
pub async fn run_auto_cleanup<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, AppState>,
    settings: CleanupSettings,
) -> Result<(), String> {
    if !settings.auto_cleanup_enabled {
        log::debug!("Auto cleanup is disabled, skipping");
        return Ok(());
    }

    log::info!("Running auto cleanup with settings: {:?}", settings);

    // Get all installed packages to identify versioned installs
    let installed_packages = get_installed_packages_full(app.clone(), state.clone()).await?;

    // Separate regular packages from versioned installs
    let regular_packages: Vec<String> = installed_packages
        .iter()
        .filter(|pkg| matches!(pkg.installation_type, crate::models::InstallationType::Standard))
        .map(|pkg| pkg.name.clone())
        .collect();

    let versioned_packages: Vec<String> = installed_packages
        .iter()
        .filter(|pkg| matches!(pkg.installation_type, crate::models::InstallationType::Versioned | crate::models::InstallationType::Custom))
        .map(|pkg| pkg.name.clone())
        .collect();

    log::info!(
        "Found {} regular packages and {} versioned installs",
        regular_packages.len(),
        versioned_packages.len()
    );

    // Run cleanup operations based on user settings
    let scoop_path = state.scoop_path();

    if settings.cleanup_old_versions && !regular_packages.is_empty() {
        log::info!(
            "Running auto cleanup of old versions (preserving {} versions)",
            settings.preserve_version_count
        );
        cleanup_old_versions_smart(
            &scoop_path,
            &regular_packages,
            settings.preserve_version_count,
        )
        .await?;
    }

    if settings.cleanup_cache && !regular_packages.is_empty() {
        log::info!("Running auto cleanup of outdated cache");
        cleanup_cache_for_packages(&regular_packages).await?;
    }

    log::info!("Auto cleanup completed successfully");
    Ok(())
}

/// Cleans up old versions of packages while preserving the most recent N versions.
///
/// This function reads the version directories for each package and removes the oldest
/// versions while keeping the specified number of recent versions.
async fn cleanup_old_versions_smart(
    scoop_path: &PathBuf,
    packages: &[String],
    keep_count: usize,
) -> Result<(), String> {
    cleanup_old_versions_for_packages(scoop_path, packages, keep_count).await
}

pub(crate) async fn cleanup_old_versions_for_packages(
    scoop_path: &PathBuf,
    packages: &[String],
    keep_count: usize,
) -> Result<(), String> {
    let apps_path = scoop_path.join("apps");
    let mut failures = Vec::new();

    for package_name in packages {
        let package_path = apps_path.join(package_name);
        if !package_path.is_dir() {
            continue;
        }

        let versions_to_remove = get_versions_to_remove(&package_path, keep_count)?;

        if !versions_to_remove.is_empty() {
            log::debug!(
                "Package '{}' has {} old versions to remove (keeping current + {} old versions)",
                package_name,
                versions_to_remove.len(),
                keep_count
            );

            if let Err(error) = remove_specific_versions(&package_path, package_name, &versions_to_remove) {
                failures.push(error);
            }
        }
    }

    if failures.is_empty() {
        Ok(())
    } else {
        Err(format!("Failed to remove some old versions: {}", failures.join("; ")))
    }
}

fn get_versions_to_remove(
    package_path: &PathBuf,
    keep_count: usize,
) -> Result<Vec<String>, String> {
    let current_version = get_current_version(package_path);
    let version_entries: Vec<VersionEntry> = fs::read_dir(package_path)
        .map_err(|e| format!("Failed to read package directory: {}", e))?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let file_name = entry.file_name().to_string_lossy().to_string();

            if file_name == "current" || !entry.file_type().ok()?.is_dir() {
                return None;
            }

            let path = package_path.join(&file_name);

            if let Some(parent_version) = parse_old_backup_parent(&file_name) {
                return Some(VersionEntry::Backup {
                    file_name,
                    parent_version,
                });
            }

            if !is_valid_version_string(&file_name) {
                return None;
            }

            Some(VersionEntry::Version {
                file_name: file_name.clone(),
                modified_time: get_version_modified_time(&path),
            })
        })
        .collect();

    Ok(select_versions_to_remove(
        version_entries,
        keep_count,
        current_version,
    ))
}

#[derive(Debug, Clone)]
enum VersionEntry {
    Version {
        file_name: String,
        modified_time: u128,
    },
    Backup {
        file_name: String,
        parent_version: String,
    },
}

fn parse_old_backup_parent(file_name: &str) -> Option<String> {
    let stripped = file_name.strip_prefix('_').unwrap_or(file_name);
    let base = stripped.strip_suffix(")").unwrap_or(stripped);
    let base = base.strip_suffix(".old").or_else(|| {
        let idx = base.rfind(".old(")?;
        Some(&base[..idx])
    })?;

    if is_valid_version_string(base) {
        Some(base.to_string())
    } else {
        None
    }
}

fn select_versions_to_remove(
    version_entries: Vec<VersionEntry>,
    keep_count: usize,
    current_version: Option<String>,
) -> Vec<String> {
    let keep_count = keep_count.saturating_add(1).max(1);

    let mut backup_map: HashMap<String, Vec<String>> = HashMap::new();
    let mut versions: Vec<(String, u128)> = Vec::new();

    for entry in version_entries {
        match entry {
            VersionEntry::Version {
                file_name,
                modified_time,
            } => versions.push((file_name, modified_time)),
            VersionEntry::Backup {
                file_name,
                parent_version,
            } => backup_map.entry(parent_version).or_default().push(file_name),
        }
    }

    if versions.len() > keep_count {
        versions.sort_by(|a, b| {
            b.1.cmp(&a.1)
                .then_with(|| compare_versions(&b.0, &a.0))
        });

        let mut versions_to_keep = HashSet::new();
        if let Some(current_version) = current_version {
            versions_to_keep.insert(current_version);
        }

        for (version, _) in &versions {
            if versions_to_keep.len() >= keep_count {
                break;
            }
            versions_to_keep.insert(version.clone());
        }

        versions
            .into_iter()
            .map(|(version, _)| version)
            .filter(|version| !versions_to_keep.contains(version))
            .flat_map(|version| {
                let mut paths = vec![version.clone()];
                if let Some(backups) = backup_map.get(&version) {
                    paths.extend(backups.iter().cloned());
                }
                paths
            })
            .collect()
    } else {
        let mut remove_paths = Vec::new();

        for version in backup_map.keys() {
            if !versions.iter().any(|(file_name, _)| file_name == version) {
                remove_paths.extend(backup_map.get(version).cloned().unwrap_or_default());
            }
        }

        remove_paths
    }
}

fn remove_specific_versions(
    package_dir: &Path,
    package_name: &str,
    versions: &[String],
) -> Result<(), String> {
    let mut failures = Vec::new();

    for version in versions {
        let version_dir = package_dir.join(version);
        log::info!("Removing old version directory: {}", version_dir.display());

        if let Err(e) = fs::remove_dir_all(&version_dir) {
            log::warn!(
                "Failed to remove version directory {}: {}",
                version_dir.display(),
                e
            );
            failures.push(format!("{}@{} ({})", package_name, version, e));
        } else {
            log::debug!("Successfully removed version {}", version);
        }
    }

    if failures.is_empty() {
        Ok(())
    } else {
        Err(failures.join(", "))
    }
}

/// Cleans up the cache for specified packages.
async fn cleanup_cache_for_packages(packages: &[String]) -> Result<(), String> {
    if packages.is_empty() {
        return Ok(());
    }

    let mut failures = Vec::new();

    for command in build_cleanup_cache_commands(packages) {
        match powershell::create_powershell_command(&command)
            .output()
            .await
        {
            Ok(output) => {
                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                    log::warn!("Cache cleanup completed with warnings: {}", stderr);
                    failures.push(if stderr.is_empty() {
                        format!("{} exited with status {}", command, output.status)
                    } else {
                        format!("{}: {}", command, stderr)
                    });
                }
            }
            Err(e) => {
                log::warn!("Failed to execute cache cleanup: {}", e);
                failures.push(format!("{}: {}", command, e));
            }
        }
    }

    if failures.is_empty() {
        log::debug!(
            "Successfully cleaned up cache for {} packages",
            packages.len()
        );
        Ok(())
    } else {
        Err(format!("Cache cleanup failed: {}", failures.join("; ")))
    }
}

fn get_current_version(package_path: &Path) -> Option<String> {
    let current_path = package_path.join("current");
    let metadata = fs::symlink_metadata(&current_path).ok()?;

    if !metadata.file_type().is_symlink() {
        return None;
    }

    fs::read_link(&current_path)
        .ok()?
        .file_name()
        .and_then(|name| name.to_str())
        .map(String::from)
}

fn is_valid_version_string(version: &str) -> bool {
    !version.is_empty()
        && version.chars().any(|c| c.is_ascii_digit())
        && !version.starts_with('.')
        && version.len() <= 50
}

fn get_version_modified_time(version_path: &Path) -> u128 {
    let install_manifest = version_path.join("install.json");
    let manifest_path = version_path.join("manifest.json");

    fs::metadata(&install_manifest)
        .or_else(|_| fs::metadata(&manifest_path))
        .or_else(|_| fs::metadata(version_path))
        .and_then(|meta| meta.modified())
        .ok()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

pub(crate) fn quote_powershell_arg(arg: &str) -> String {
    format!("'{}'", arg.replace('\'', "''"))
}

pub(crate) fn build_cleanup_cache_commands(packages: &[String]) -> Vec<String> {
    let max_command_length = 6000;
    let mut chunks: Vec<Vec<String>> = Vec::new();
    let mut current_chunk = Vec::new();
    let mut current_length = "scoop cache rm".len();

    for package in packages {
        let quoted_package = quote_powershell_arg(package);
        let next_length = current_length + quoted_package.len() + 1;

        if !current_chunk.is_empty() && next_length > max_command_length {
            chunks.push(current_chunk);
            current_chunk = Vec::new();
            current_length = "scoop cache rm".len();
        }

        current_length += quoted_package.len() + 1;
        current_chunk.push(quoted_package);
    }

    if !current_chunk.is_empty() {
        chunks.push(current_chunk);
    }

    chunks
        .into_iter()
        .map(|chunk| format!("scoop cache rm {}", chunk.join(" ")))
        .collect()
}
/// This reads the cleanup settings from the store and runs the cleanup if enabled.
///
/// This function is designed to be called after operations like install, update, or uninstall.
pub async fn trigger_auto_cleanup<R: Runtime>(app: AppHandle<R>, state: State<'_, AppState>) {
    // Read cleanup settings from the store
    let cleanup_settings = match read_cleanup_settings(&app) {
        Ok(settings) => settings,
        Err(e) => {
            log::debug!("Could not read cleanup settings: {}", e);
            return;
        }
    };

    // If auto cleanup is not enabled, return early
    if !cleanup_settings.auto_cleanup_enabled {
        log::debug!("Auto cleanup is disabled");
        return;
    }

    log::info!("Triggering auto cleanup in background");

    // Run cleanup directly - it's already async and won't block
    if let Err(e) = run_auto_cleanup(app, state, cleanup_settings).await {
        log::warn!("Auto cleanup failed: {}", e);
    }
}

/// Reads cleanup settings from the persistent store.
pub(crate) fn read_cleanup_settings<R: Runtime>(app: &AppHandle<R>) -> Result<CleanupSettings, String> {
    let get_val = |key: &str| {
        // First get the settings object from the store
        let settings_value = settings::get_config_value(app.clone(), "settings".to_string())
            .ok()
            .flatten()
            .ok_or_else(|| format!("Settings object not found in store"))?;

        // Parse as object and access nested cleanup settings
        if let serde_json::Value::Object(settings_obj) = settings_value {
            if let Some(cleanup_val) = settings_obj.get("cleanup") {
                if let serde_json::Value::Object(cleanup_obj) = cleanup_val {
                    if let Some(val) = cleanup_obj.get(key) {
                        return Ok(val.clone());
                    }
                }
            }
        }
        Err(format!("Cleanup setting '{}' not found", key))
    };

    Ok(CleanupSettings {
        auto_cleanup_enabled: get_val("autoCleanupEnabled")
            .ok()
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        cleanup_old_versions: get_val("cleanupOldVersions")
            .ok()
            .and_then(|v| v.as_bool())
            .unwrap_or(true),
        cleanup_cache: get_val("cleanupCache")
            .ok()
            .and_then(|v| v.as_bool())
            .unwrap_or(true),
        preserve_version_count: get_val("preserveVersionCount")
            .ok()
            .and_then(|v| v.as_u64())
            .unwrap_or(3) as usize,
    })
}

/// Compares two version strings using semantic version logic.
/// Returns std::cmp::Ordering::Less if a < b, Greater if a > b, Equal if same.
fn compare_versions(a: &str, b: &str) -> std::cmp::Ordering {
    // Split version from prerelease tags (e.g., "1.2.3-beta.1" -> "1.2.3" and "beta.1")
    let split_version = |v: &str| -> (Vec<u32>, Option<String>) {
        let parts: Vec<&str> = v.split('-').collect();
        let version_parts: Vec<u32> = parts[0]
            .split('.')
            .filter_map(|s| s.parse().ok())
            .collect();
        let prerelease = parts.get(1).map(|&s| s.to_string());
        (version_parts, prerelease)
    };
    
    let (a_ver, a_pre) = split_version(a);
    let (b_ver, b_pre) = split_version(b);
    
    // Compare main version numbers
    for i in 0..std::cmp::max(a_ver.len(), b_ver.len()) {
        let a_val = a_ver.get(i).unwrap_or(&0);
        let b_val = b_ver.get(i).unwrap_or(&0);
        
        match a_val.cmp(b_val) {
            std::cmp::Ordering::Equal => continue,
            ordering => return ordering,
        }
    }
    
    // Main versions are equal, compare prerelease tags
    match (a_pre, b_pre) {
        (None, None) => std::cmp::Ordering::Equal,
        (None, Some(_)) => std::cmp::Ordering::Greater,  // Stable version > prerelease
        (Some(_), None) => std::cmp::Ordering::Less,     // Prerelease < stable version
        (Some(a_pre), Some(b_pre)) => {
            // Parse prerelease identifiers (e.g., "beta.10" -> ("beta", 10))
            let parse_prerelease = |pre: &str| -> (String, Vec<u32>) {
                let parts: Vec<&str> = pre.split('.').collect();
                let identifier = parts[0].to_string();
                let numbers: Vec<u32> = parts.iter()
                    .skip(1)
                    .filter_map(|s| s.parse().ok())
                    .collect();
                (identifier, numbers)
            };
            
            let (a_id, a_nums) = parse_prerelease(&a_pre);
            let (b_id, b_nums) = parse_prerelease(&b_pre);
            
            // Compare prerelease type (alpha < beta < rc < others)
            let prerelease_order = |id: &str| -> u8 {
                if id.starts_with("alpha") { 1 }
                else if id.starts_with("beta") { 2 }
                else if id.starts_with("rc") { 3 }
                else { 4 }
            };
            
            let a_order = prerelease_order(&a_id);
            let b_order = prerelease_order(&b_id);
            
            match a_order.cmp(&b_order) {
                std::cmp::Ordering::Equal => {
                    // Same prerelease type, compare numeric parts
                    for i in 0..std::cmp::max(a_nums.len(), b_nums.len()) {
                        let a_num = a_nums.get(i).unwrap_or(&0);
                        let b_num = b_nums.get(i).unwrap_or(&0);
                        match a_num.cmp(b_num) {
                            std::cmp::Ordering::Equal => continue,
                            ordering => return ordering,
                        }
                    }
                    std::cmp::Ordering::Equal
                }
                ordering => ordering,
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use tempfile::tempdir;

    fn create_version_directories(package_path: &Path, versions: &[&str]) {
        for version in versions {
            fs::create_dir_all(package_path.join(version)).unwrap();
        }
    }

    mod version_selection {
        use super::*;

        #[test]
        fn preserves_current_version_even_when_keep_count_is_one() {
            let versions = vec![
                VersionEntry::Version {
                    file_name: "1.0.0".to_string(),
                    modified_time: 1,
                },
                VersionEntry::Version {
                    file_name: "1.5.0".to_string(),
                    modified_time: 2,
                },
                VersionEntry::Version {
                    file_name: "2.0.0".to_string(),
                    modified_time: 3,
                },
            ];

            let versions_to_remove =
                select_versions_to_remove(versions, 1, Some("1.0.0".to_string()));

            assert_eq!(versions_to_remove, vec!["1.5.0".to_string()]);
        }

        #[test]
        fn keeps_backup_folders_attached_to_kept_versions() {
            let temp_dir = tempdir().unwrap();
            let package_path = temp_dir.path().join("demo");

            create_version_directories(&package_path, &["1.0.0", "2.0.0", "3.0.0"]);
            fs::create_dir_all(package_path.join("_1.0.0.old")).unwrap();
            fs::create_dir_all(package_path.join("_1.0.0.old(1)")).unwrap();
            fs::create_dir_all(package_path.join("current")).unwrap();

            let versions_to_remove = get_versions_to_remove(&package_path, 1).unwrap();

            assert_eq!(versions_to_remove.len(), 1);
            assert!(!versions_to_remove.iter().any(|version| version == "_1.0.0.old"));
            assert!(!versions_to_remove.iter().any(|version| version == "_1.0.0.old(1)"));
        }
    }

    mod filesystem_cleanup {
        use super::*;

        #[tokio::test]
        async fn removes_old_versions_from_temp_scoop_layout() {
            let temp_dir = tempdir().unwrap();
            let scoop_path = temp_dir.path().to_path_buf();
            let package_path = scoop_path.join("apps").join("demo");

            create_version_directories(&package_path, &["1.0.0", "2.0.0", "3.0.0"]);

            cleanup_old_versions_for_packages(&scoop_path, &["demo".to_string()], 1)
                .await
                .unwrap();

            assert!(package_path.join("3.0.0").exists());
            assert!(package_path.join("2.0.0").exists());
            assert!(!package_path.join("1.0.0").exists());
        }

        #[test]
        fn remove_specific_versions_deletes_only_requested_directories() {
            let temp_dir = tempdir().unwrap();
            let package_path = temp_dir.path().join("demo");

            create_version_directories(&package_path, &["1.0.0", "2.0.0", "3.0.0"]);

            remove_specific_versions(&package_path, "demo", &["1.0.0".to_string(), "2.0.0".to_string()])
                .unwrap();

            assert!(!package_path.join("1.0.0").exists());
            assert!(!package_path.join("2.0.0").exists());
            assert!(package_path.join("3.0.0").exists());
        }
    }

    mod cache_commands {
        use super::*;

        #[test]
        fn quotes_arguments_and_splits_long_commands() {
            let mut packages = vec!["pkg'o".to_string()];
            packages.extend((0..800).map(|index| format!("package-{:03}", index)));

            let commands = build_cleanup_cache_commands(&packages);

            assert!(commands.len() > 1);
            assert!(commands[0].contains("'pkg''o'"));
            assert!(commands.iter().all(|command| command.starts_with("scoop cleanup ")));
            assert!(commands.iter().all(|command| command.ends_with(" --cache")));
        }
    }

    mod smoke_tests {
        use super::*;

        #[test]
        fn cleanup_fake_scoop_root_when_env_is_set() {
            let scoop_root = match std::env::var("PAILER_FAKE_SCOOP_PATH") {
                Ok(value) => PathBuf::from(value),
                Err(_) => return,
            };

            let old_version_count = std::env::var("PAILER_FAKE_OLD_VERSION_COUNT")
                .or_else(|_| std::env::var("PAILER_FAKE_KEEP_COUNT"))
                .ok()
                .and_then(|value| value.parse::<usize>().ok())
                .unwrap_or(3);

            let package_name = std::env::var("PAILER_FAKE_PACKAGE_NAME")
                .unwrap_or_else(|_| "demo".to_string());

            let rt = tokio::runtime::Runtime::new().unwrap();
            rt.block_on(async {
                cleanup_old_versions_for_packages(
                    &scoop_root,
                    &[package_name.clone()],
                    old_version_count,
                )
                .await
                .unwrap();
            });

            let package_path = scoop_root.join("apps").join(&package_name);
            let remaining_dirs: Vec<String> = fs::read_dir(&package_path)
                .unwrap()
                .filter_map(|entry| {
                    let entry = entry.ok()?;
                    if !entry.file_type().ok()?.is_dir() {
                        return None;
                    }

                    let name = entry.file_name().to_string_lossy().to_string();
                    if name == "current" {
                        return None;
                    }

                    Some(name)
                })
                .collect();

            let remaining_versions: Vec<String> = remaining_dirs
                .iter()
                .filter(|name| is_valid_version_string(name))
                .cloned()
                .collect();

            assert_eq!(
                remaining_versions.len(),
                old_version_count + 1,
                "expected current/latest version + {} old versions to remain, got {:?}",
                old_version_count,
                remaining_dirs
            );

            assert!(!package_path.join("1.0.0").exists(), "oldest version should be removed");
            assert!(package_path.join("1.1.0").exists(), "version 1.1.0 should remain");
            assert!(package_path.join("1.2.0").exists(), "version 1.2.0 should remain");
            assert!(package_path.join("1.3.0").exists(), "version 1.3.0 should remain");
            assert!(package_path.join("1.4.0").exists(), "latest version should remain");
        }
    }
}
