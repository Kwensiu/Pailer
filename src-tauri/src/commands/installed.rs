//! Command for fetching all installed Scoop packages from the filesystem.
use crate::models::{parse_notes_field, InstallManifest, PackageManifest, ScoopPackage};
use crate::state::{AppState, InstalledPackagesCache};
use chrono::{DateTime, Utc};
use rayon::prelude::*;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Runtime, State};

/// Helper to get modification time of a path (file or directory) in milliseconds.
fn get_path_modification_time(path: &Path) -> u128 {
    fs::metadata(path)
        .and_then(|meta| meta.modified())
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

fn format_modified_time(path: &Path) -> Result<String, String> {
    let metadata = fs::metadata(path)
        .map_err(|e| format!("Failed to read metadata for {}: {}", path.display(), e))?;
    let modified = metadata
        .modified()
        .map_err(|e| format!("Failed to read modified time for {}: {}", path.display(), e))?;

    Ok(DateTime::<Utc>::from(modified).to_rfc3339())
}

/// Helper to get modification time of an installation directory.
/// Checks install.json, then manifest.json, then the directory itself.
fn get_install_modification_time(install_dir: &Path) -> u128 {
    let install_manifest = install_dir.join("install.json");
    let manifest_path = install_dir.join("manifest.json");

    fs::metadata(&install_manifest)
        .or_else(|_| fs::metadata(&manifest_path))
        .or_else(|_| fs::metadata(install_dir))
        .and_then(|meta| meta.modified())
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

/// Searches for a package manifest in all bucket directories to determine the bucket.
fn find_package_bucket(scoop_path: &Path, package_name: &str) -> Option<String> {
    let buckets_path = scoop_path.join("buckets");

    log::trace!(
        "Searching for package bucket. Scoop path: {}, Package name: {}",
        scoop_path.display(),
        package_name
    );

    if let Ok(buckets) = fs::read_dir(&buckets_path) {
        for bucket_entry in buckets.flatten() {
            if bucket_entry.path().is_dir() {
                let bucket_name = bucket_entry.file_name().to_string_lossy().to_string();
                // Check bucket path: buckets/{bucket}/bucket/{package}.json
                let manifest_path = bucket_entry
                    .path()
                    .join("bucket")
                    .join(format!("{}.json", package_name));

                log::trace!(
                    "Checking bucket: {}, manifest path: {}",
                    bucket_name,
                    manifest_path.display()
                );
                if manifest_path.exists() {
                    log::trace!("Found package {} in bucket {}", package_name, bucket_name);
                    return Some(bucket_name);
                }
            }
        }
    }

    // Fallback: check if it's in the main bucket (which might not be in buckets dir)
    log::trace!("Package {} not found in any bucket", package_name);
    None
}

/// Returns the most recently updated version directory for a package when the
/// `current` link is missing.
fn find_latest_version_dir(package_path: &Path) -> Option<PathBuf> {
    let mut candidates: Vec<(u128, PathBuf)> = Vec::new();

    log::trace!(
        "Finding latest version directory for package: {}",
        package_path.display()
    );

    if let Ok(entries) = fs::read_dir(package_path) {
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

            let install_manifest = path.join("install.json");
            let manifest_path = path.join("manifest.json");

            if !install_manifest.exists() && !manifest_path.exists() {
                continue;
            }

            let modified = fs::metadata(&install_manifest)
                .or_else(|_| fs::metadata(&manifest_path))
                .or_else(|_| fs::metadata(&path))
                .and_then(|meta| meta.modified())
                .ok()
                .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_millis())
                .unwrap_or(0);

            candidates.push((modified, path));
        }
    }

    candidates.sort_by(|a, b| b.0.cmp(&a.0));
    let result = candidates.into_iter().map(|(_, path)| path).next();
    log::trace!(
        "Latest version directory found: {:?}",
        result.as_ref().map(|p| p.display().to_string())
    );
    result
}

fn locate_install_dir(package_path: &Path) -> Result<PathBuf, String> {
    let package_name = extract_package_name(package_path)?;
    let current_path = package_path.join("current");

    if current_path.is_dir() {
        Ok(current_path)
    } else if let Some(fallback_dir) = find_latest_version_dir(package_path) {
        log::debug!(
            "=== INSTALLED SCAN === 'current' missing for {}; using latest version directory '{}'",
            package_name,
            fallback_dir.display(),
        );
        Ok(fallback_dir)
    } else {
        Err(format!(
            "'current' directory not found for {} and no version directories available",
            package_name
        ))
    }
}

fn compute_apps_fingerprint(app_dirs: &[PathBuf]) -> String {
    log::debug!(
        "Computing apps fingerprint for {} app directories",
        app_dirs.len()
    );
    let mut located_packages = Vec::new();

    let entries: Vec<String> = app_dirs
        .iter()
        .filter_map(|path| {
            path.file_name()
                .and_then(|n| n.to_str())
                .map(|name| match locate_install_dir(path) {
                    Ok(install_dir) => {
                        located_packages.push(name.to_string());
                        let modified_stamp = get_install_modification_time(&install_dir);
                        format!("{}:{}", name.to_ascii_lowercase(), modified_stamp)
                    }
                    Err(_) => {
                        let modified_stamp = get_path_modification_time(path);
                        format!("{}:{}", name.to_ascii_lowercase(), modified_stamp)
                    }
                })
        })
        .collect();

    // Log located packages summary
    log::debug!(
        "Located current directories for {} packages",
        located_packages.len()
    );
    if located_packages.len() <= 10 {
        log::debug!("Packages: {}", located_packages.join(", "));
    } else {
        log::debug!("First 10 packages: {}", located_packages[..10].join(", "));
        log::debug!("... and {} more packages", located_packages.len() - 10);
    }

    let mut sorted_entries = entries;
    sorted_entries.sort();
    format!("{}|{}", app_dirs.len(), sorted_entries.join(";"))
}

/// Attempts to load manifest.json and install.json with various fallback strategies.
fn load_manifests_with_fallback(
    install_root: &Path,
    package_name: &str,
) -> Result<(PackageManifest, InstallManifest), String> {
    // Try to read manifest.json
    let manifest_path = install_root.join("manifest.json");
    log::trace!("Reading manifest.json for package: {}", package_name);

    let manifest = if manifest_path.exists() {
        let manifest_content = fs::read_to_string(&manifest_path)
            .map_err(|e| format!("Failed to read manifest.json for {}: {}", package_name, e))?;

        // Parse JSON and extract all fields including new homepage, license, notes fields
        let json: serde_json::Value = serde_json::from_str(&manifest_content)
            .map_err(|e| format!("Failed to parse manifest.json for {}: {}", package_name, e))?;

        PackageManifest {
            version: json
                .get("version")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string(),
            description: json
                .get("description")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            homepage: json
                .get("homepage")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            license: json
                .get("license")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            notes: parse_notes_field(&json),
        }
    } else {
        // Return error if manifest doesn't exist
        return Err(format!(
            "Failed to read manifest.json for {}: file not found",
            package_name
        ));
    };

    // Try to read install.json
    let install_manifest_path = install_root.join("install.json");
    log::trace!("Reading install.json for package: {}", package_name);

    let install_manifest = if install_manifest_path.exists() {
        let install_manifest_content = fs::read_to_string(&install_manifest_path)
            .map_err(|e| format!("Failed to read install.json for {}: {}", package_name, e))?;
        serde_json::from_str(&install_manifest_content)
            .map_err(|e| format!("Failed to parse install.json for {}: {}", package_name, e))?
    } else {
        // Return error if install.json doesn't exist
        return Err(format!(
            "Failed to read install.json for {}: file not found",
            package_name
        ));
    };

    Ok((manifest, install_manifest))
}

/// Attempts to extract version information from directory structure or files.
fn extract_version_from_directory(install_root: &Path) -> Option<String> {
    // Try to get version from parent directory name
    if let Some(dir_name) = install_root.file_name().and_then(|n| n.to_str()) {
        // Check if directory name looks like a version
        if is_valid_version_string(dir_name) {
            return Some(dir_name.to_string());
        }
    }

    // Try to find version in any .json file content
    if let Ok(entries) = fs::read_dir(install_root) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(content) = fs::read_to_string(&path) {
                    match serde_json::from_str::<serde_json::Value>(&content) {
                        Ok(json) => {
                            if let Some(version) = json.get("version").and_then(|v| v.as_str()) {
                                if !version.is_empty() {
                                    return Some(version.to_string());
                                }
                            }
                        }
                        Err(e) => {
                            let package_name = install_root
                                .file_name()
                                .and_then(|n| n.to_str())
                                .unwrap_or("unknown");
                            log::warn!(
                                "Failed to parse JSON file in package {}: {}",
                                package_name,
                                e
                            );
                            // Continue processing other files
                        }
                    }
                }
            }
        }
    }

    None
}

/// Validates if a string looks like a valid version string.
fn is_valid_version_string(s: &str) -> bool {
    if s.is_empty() {
        return false;
    }

    // Simple validation: contains digits and no invalid characters
    let has_digit = s.chars().any(|c| c.is_ascii_digit());
    let has_invalid_chars = s
        .chars()
        .any(|c| !c.is_ascii_alphanumeric() && c != '.' && c != '-' && c != '_');

    has_digit && !has_invalid_chars && !s.starts_with(['.', '-']) && !s.ends_with(['.', '-'])
}

/// Extracts package name from package directory path.
fn extract_package_name(package_path: &Path) -> Result<String, String> {
    package_path
        .file_name()
        .and_then(|n| n.to_str())
        .map(|s| s.to_string())
        .ok_or_else(|| format!("Invalid package directory name: {:?}", package_path))
}

/// Checks if a directory shows evidence of being a real package installation (not just a system directory like scoop itself).
fn has_installation_evidence(install_root: &Path) -> bool {
    // Check if there are version directories (indicating versioned install)
    let has_version_dirs = fs::read_dir(install_root)
        .ok()
        .map(|entries| {
            entries
                .flatten()
                .filter(|entry| entry.path().is_dir())
                .any(|entry| {
                    entry
                        .file_name()
                        .to_str()
                        .map(|name| name != "current" && is_valid_version_string(name))
                        .unwrap_or(false)
                })
        })
        .unwrap_or(false);

    // Check if there are executable files
    let has_executables = fs::read_dir(install_root)
        .ok()
        .map(|entries| {
            entries.flatten().any(|entry| {
                let path = entry.path();
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    // Common executable extensions
                    matches!(
                        ext.to_lowercase().as_str(),
                        "exe" | "cmd" | "bat" | "ps1" | "lnk"
                    )
                } else {
                    false
                }
            })
        })
        .unwrap_or(false);

    // Check if there are common application directories
    let has_app_dirs = ["bin", "lib", "share", "data"]
        .iter()
        .any(|dir_name| install_root.join(dir_name).is_dir());

    // If any of these conditions are met, it likely contains a real installation
    has_version_dirs || has_executables || has_app_dirs
}

/// Loads package manifest and install manifest with fallback strategies.
fn load_package_info(
    install_root: &Path,
    package_name: &str,
) -> Result<(PackageManifest, InstallManifest), String> {
    // Exclude Scoop itself
    if package_name.eq_ignore_ascii_case("scoop") {
        return Err("Skipping Scoop system package".to_string());
    }

    match load_manifests_with_fallback(install_root, package_name) {
        Ok(result) => Ok(result),
        Err(e) => {
            // Only create fallback manifests if there's evidence of a real installation
            if has_installation_evidence(install_root) {
                log::warn!(
                    "Failed to load manifests for {}: {}, creating fallback manifests",
                    package_name,
                    e
                );
                let version = extract_version_from_directory(install_root)
                    .unwrap_or_else(|| "unknown".to_string());
                let description = Some(format!("Package: {} (Custom installation)", package_name));
                let manifest = PackageManifest {
                    version,
                    description,
                    ..Default::default()
                };
                let install_manifest = InstallManifest {
                    bucket: None,
                    ..Default::default()
                };
                Ok((manifest, install_manifest))
            } else {
                // No installation evidence, skip this directory
                Err(e)
            }
        }
    }
}

/// Determines the bucket for a package, with intelligent fallback logic.
fn determine_bucket(
    install_manifest: &InstallManifest,
    scoop_path: &Path,
    package_name: &str,
) -> String {
    if let Some(ref bucket_name) = install_manifest.bucket {
        // Normal bucket installation
        bucket_name.clone()
    } else {
        // Custom or unknown installation - try to find in buckets first
        match find_package_bucket(scoop_path, package_name) {
            Some(found_bucket) => {
                log::trace!("Found package {} in bucket: {}", package_name, found_bucket);
                found_bucket
            }
            None => {
                // Truly custom installation
                log::trace!(
                    "Package {} appears to be custom installed, marking as Custom",
                    package_name
                );
                "Custom".to_string()
            }
        }
    }
}

/// Gets the package directory modified time from the package main directory (e.g., D:\Scoop\apps\7zip)
/// This represents the last time the user interacted with this package (install, update, switch version, etc.)
fn get_package_directory_modified_time(package_dir: &Path) -> Result<String, String> {
    format_modified_time(package_dir)
}

/// Gets the install.json modification time from the current version directory
/// This represents the actual installation date of the current version
fn get_current_version_install_date(package_dir: &Path) -> Result<String, String> {
    let install_root = match locate_install_dir(package_dir) {
        Ok(dir) => dir,
        Err(e) => return Err(e),
    };

    let install_manifest = install_root.join("install.json");

    format_modified_time(&install_manifest)
}

/// Gets the manifest.json modification time from the current version directory  
/// This represents the version update date (when this version was last updated/refreshed)
fn get_current_version_update_date_impl(package_dir: &Path) -> Result<String, String> {
    let install_root = match locate_install_dir(package_dir) {
        Ok(dir) => dir,
        Err(e) => return Err(e),
    };

    let manifest_path = install_root.join("manifest.json");

    format_modified_time(&manifest_path)
}

/// Builds a ScoopPackage from the collected information.
fn build_scoop_package(
    package_name: String,
    manifest: PackageManifest,
    bucket: String,
    updated_time: String,
    has_version_dirs: bool,
) -> ScoopPackage {
    // Configure installation type based on bucket
    let installation_type = match bucket.as_str() {
        "versions" => crate::models::InstallationType::Versioned,
        "Custom" => crate::models::InstallationType::Custom,
        _ => crate::models::InstallationType::Standard,
    };

    ScoopPackage {
        name: package_name,
        version: manifest.version,
        source: bucket,
        updated: updated_time,
        is_installed: true,
        is_installed_from_current_bucket: true,
        info: manifest.description.unwrap_or_default(),
        homepage: manifest.homepage,
        license: manifest.license,
        notes: manifest.notes,
        match_source: crate::models::MatchSource::default(),
        installation_type,
        has_multiple_versions: has_version_dirs,
        local_latest_version: None,
    }
}

/// Loads the details for a single installed package from its directory.
/// Uses enhanced error recovery to handle various installation scenarios.
fn load_package_details(package_path: &Path, scoop_path: &Path) -> Result<ScoopPackage, String> {
    let package_name = extract_package_name(package_path)?;
    log::trace!("Loading package details for: {}", package_name);

    // Check if this package has version directories (indicating versioned install)
    let has_version_dirs = fs::read_dir(package_path)
        .ok()
        .map(|entries| {
            entries
                .flatten()
                .filter(|entry| entry.path().is_dir())
                .filter_map(|entry| entry.file_name().to_str().map(|s| s.to_string()))
                .any(|name| name != "current" && is_valid_version_string(&name))
        })
        .unwrap_or(false);

    let install_root = locate_install_dir(package_path)?;
    let (manifest, install_manifest) = load_package_info(&install_root, &package_name)?;
    let bucket = determine_bucket(&install_manifest, scoop_path, &package_name);
    let updated_time = get_package_directory_modified_time(package_path).unwrap_or_default(); // Use package_path (main directory) instead of install_root (current directory)

    // Find the latest local version if multiple versions exist
    let local_latest_version = if has_version_dirs {
        fs::read_dir(package_path)
            .ok()
            .map(|entries| {
                let mut versions: Vec<String> = entries
                    .flatten()
                    .filter(|entry| entry.path().is_dir())
                    .filter_map(|entry| entry.file_name().to_str().map(|s| s.to_string()))
                    .filter(|name| name != "current" && is_valid_version_string(name))
                    .collect();

                // Sort versions to find the latest one
                // Use a natural sort approach: split by dots/hyphens and compare segments
                versions.sort_by(|a, b| {
                    let a_parts: Vec<&str> = a.split(|c: char| !c.is_alphanumeric()).collect();
                    let b_parts: Vec<&str> = b.split(|c: char| !c.is_alphanumeric()).collect();

                    for (a_p, b_p) in a_parts.iter().zip(b_parts.iter()) {
                        let a_num = a_p.parse::<u64>();
                        let b_num = b_p.parse::<u64>();

                        match (a_num, b_num) {
                            (Ok(an), Ok(bn)) if an != bn => return an.cmp(&bn),
                            (Ok(_), Err(_)) => return std::cmp::Ordering::Greater,
                            (Err(_), Ok(_)) => return std::cmp::Ordering::Less,
                            _ if a_p != b_p => return a_p.cmp(b_p),
                            _ => continue,
                        }
                    }
                    a_parts.len().cmp(&b_parts.len())
                });
                versions.last().cloned()
            })
            .flatten()
    } else {
        None
    };

    log::trace!("Determined bucket for package {}: {}", package_name, bucket);

    let mut pkg = build_scoop_package(
        package_name,
        manifest,
        bucket,
        updated_time,
        has_version_dirs,
    );
    pkg.local_latest_version = local_latest_version;
    Ok(pkg)
}

pub fn get_installed_package_state(
    scoop_path: &Path,
    package_name: &str,
) -> Result<Option<ScoopPackage>, String> {
    let package_path = scoop_path.join("apps").join(package_name);

    if !package_path.is_dir() {
        return Ok(None);
    }

    load_package_details(&package_path, scoop_path).map(Some)
}

/// Check if scoop path is available, but don't auto-detect or update it.
/// This function now only validates the existing configured path.
async fn refresh_scoop_path_if_needed<R: Runtime>(
    _app: AppHandle<R>,
    state: &AppState,
    reason: &str,
) -> Option<PathBuf> {
    let current_path = state.scoop_path();
    log::debug!(
        "Checking scoop path availability. Current path: {}, reason: {}",
        current_path.display(),
        reason
    );

    // Only check if the current path exists, don't auto-detect or update
    if current_path.exists() {
        log::debug!("Scoop path is valid: {}", current_path.display());
        Some(current_path)
    } else {
        log::warn!(
            "Configured Scoop path does not exist: {}",
            current_path.display()
        );
        None
    }
}

/// Internal method to perform the actual installed packages scan.
/// Separated from the public command to support both warm-up and user-initiated refresh paths.
async fn scan_installed_packages_internal<R: Runtime>(
    app: AppHandle<R>,
    state: &AppState,
    is_warmup: bool,
) -> Result<Vec<ScoopPackage>, String> {
    let log_prefix = if is_warmup {
        "=== INSTALLED WARMUP ==="
    } else {
        "=== INSTALLED SCAN ==="
    };

    log::debug!("{} Starting installed packages scan", log_prefix);

    // Ensure apps path exists
    let apps_path = match ensure_apps_path(app.clone(), state, log_prefix).await {
        Some(path) => path,
        None => {
            log::warn!(
                "{} ✗ Failed to find or refresh Scoop apps directory",
                log_prefix
            );
            return Ok(vec![]);
        }
    };

    log::debug!(
        "{} ✓ Apps directory found: {}",
        log_prefix,
        apps_path.display()
    );

    let app_dirs: Vec<PathBuf> = fs::read_dir(&apps_path)
        .map_err(|e| format!("Failed to read apps directory: {}", e))?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.is_dir())
        .collect();

    log::debug!(
        "{} Found {} app directories in apps path",
        log_prefix,
        app_dirs.len()
    );

    let fingerprint = compute_apps_fingerprint(&app_dirs);
    log::debug!(
        "{} [FINGERPRINT] Computed (length: {} chars)",
        log_prefix,
        fingerprint.len()
    );

    // Get scoop path for use in package loading
    let scoop_path = state.scoop_path();

    // Check cache
    if let Some(cached_packages) = check_cache(state, &fingerprint, log_prefix).await {
        return Ok(cached_packages);
    }

    log::debug!("{} [SCAN] Starting package directory scan", log_prefix);

    let packages: Vec<ScoopPackage> = app_dirs
        .par_iter()
        .filter_map(
            |path| match load_package_details(path.as_path(), &scoop_path) {
                Ok(package) => Some(package),
                Err(e) => {
                    let package_name = path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("unknown");
                    if e == "Skipping Scoop system package" {
                        log::debug!("{} [SCAN] Skipping Scoop system package", log_prefix);
                    } else if e.contains("'current' directory not found")
                        && e.contains("no version directories available")
                    {
                        log::debug!(
                            "{} [SCAN] Skipping package '{}': {}",
                            log_prefix,
                            package_name,
                            e
                        );
                    } else {
                        log::warn!(
                            "{} [SCAN] Skipping package '{}': {}",
                            log_prefix,
                            package_name,
                            e
                        );
                    }
                    None
                }
            },
        )
        .collect();

    log::debug!(
        "{} [SCAN] ✓ Completed scan: {} directories processed, {} valid packages found",
        log_prefix,
        app_dirs.len(),
        packages.len()
    );

    // Update cache
    update_cache(state, packages.clone(), fingerprint.clone(), log_prefix).await;

    // Also update package versions cache to maintain consistency
    update_package_versions_cache(state, &packages, &fingerprint).await;

    log::debug!(
        "{} ✓ Returning {} installed packages",
        log_prefix,
        packages.len()
    );
    Ok(packages)
}

async fn get_recent_cached_packages(
    state: &AppState,
    log_prefix: &str,
) -> Option<Vec<ScoopPackage>> {
    const RECENT_CACHE_WINDOW_MS: u64 = 30_000;

    let mut cache_guard = state.installed_packages.lock().await;
    let cache = cache_guard.as_mut()?;
    let cache_age_ms = AppState::now_ms().saturating_sub(cache.cached_at_ms);

    if cache_age_ms <= RECENT_CACHE_WINDOW_MS {
        cache.cached_at_ms = AppState::now_ms();
        log::debug!(
            "{} [CACHE] Reusing recent installed packages cache (age={}ms, packages={})",
            log_prefix,
            cache_age_ms,
            cache.packages.len()
        );
        Some(cache.packages.clone())
    } else {
        None
    }
}

#[tauri::command]
pub async fn get_installed_packages_full<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, AppState>,
) -> Result<Vec<ScoopPackage>, String> {
    log::debug!("=== INSTALLED SCAN === get_installed_packages_full called");

    if let Some(cached_packages) =
        get_recent_cached_packages(&state, "=== INSTALLED SCAN ===").await
    {
        log::debug!(
            "=== INSTALLED SCAN === get_installed_packages_full completed, result: Ok({})",
            cached_packages.len()
        );
        return Ok(cached_packages);
    }

    // Perform the scan (cache is checked inside)
    let result = scan_installed_packages_internal(app, &state, false).await;
    log::debug!(
        "=== INSTALLED SCAN === get_installed_packages_full completed, result: {:?}",
        result.as_ref().map(|pkgs| pkgs.len())
    );
    result
}

/// Invalidates the cached list of installed packages in AppState.
/// This should be called after operations that change the installed packages,
/// such as installing or uninstalling a package.
pub async fn invalidate_installed_cache(state: State<'_, AppState>) {
    let mut cache_guard = state.installed_packages.lock().await;
    let was_cached = cache_guard.is_some();
    *cache_guard = None;

    // Also invalidate the versions cache since it depends on installed packages
    let mut versions_guard = state.package_versions.lock().await;
    *versions_guard = None;

    log::debug!(
        "=== INSTALLED CACHE === Cache invalidated (was_cached: {}). Also invalidated versions cache.",
        was_cached
    );
}

/// Forces a refresh of the installed packages by invalidating cache and refetching.
/// Debounces rapid consecutive calls to prevent unnecessary scans.
#[tauri::command]
pub async fn refresh_installed_packages<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, AppState>,
    force: Option<bool>,
) -> Result<Vec<ScoopPackage>, String> {
    log::debug!("=== INSTALLED REFRESH === refresh_installed_packages called");

    // Check if we should debounce this refresh call
    if !force.unwrap_or(false) && state.should_debounce_refresh() {
        log::debug!(
            "=== INSTALLED REFRESH === Debouncing refresh (less than 1 second since last refresh)"
        );
        // Return cached results without rescanning
        let cache_guard = state.installed_packages.lock().await;
        if let Some(cache) = cache_guard.as_ref() {
            log::debug!("=== INSTALLED REFRESH === Returning cached packages due to debounce");
            return Ok(cache.packages.clone());
        }
    }

    state.update_refresh_time();

    // First invalidate cache to ensure fresh data
    log::debug!("=== INSTALLED REFRESH === Invalidating cache");
    invalidate_installed_cache(state.clone()).await;

    // Then fetch fresh data
    log::debug!("=== INSTALLED REFRESH === Fetching fresh data");
    let result = scan_installed_packages_internal(app, &state, false).await;

    log::debug!("=== INSTALLED REFRESH === refresh_installed_packages completed");
    result
}

/// Gets the installation path for a specific package.
#[tauri::command]
pub async fn get_package_path<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, AppState>,
    package_name: String,
) -> Result<String, String> {
    let package_path = state.scoop_path().join("apps").join(&package_name);

    if !package_path.exists() {
        return Err(format!("Package '{}' is not installed", package_name));
    }

    Ok(package_path.to_string_lossy().to_string())
}

async fn ensure_apps_path<R: Runtime>(
    app: AppHandle<R>,
    state: &AppState,
    log_prefix: &str,
) -> Option<PathBuf> {
    let mut scoop_path = state.scoop_path();
    let mut apps_path = scoop_path.join("apps");

    if !apps_path.is_dir() {
        log::warn!(
            "{} ✗ Scoop apps directory does not exist at: {}",
            log_prefix,
            apps_path.display()
        );

        if let Some(updated_path) =
            refresh_scoop_path_if_needed(app, state, "apps path missing").await
        {
            scoop_path = updated_path;
            apps_path = scoop_path.join("apps");
            log::debug!("{} Path refreshed to: {}", log_prefix, apps_path.display());
        }
    }

    if apps_path.is_dir() {
        Some(apps_path)
    } else {
        None
    }
}

async fn check_cache(
    state: &AppState,
    fingerprint: &str,
    log_prefix: &str,
) -> Option<Vec<ScoopPackage>> {
    let mut cache_guard = state.installed_packages.lock().await;
    if let Some(cache) = cache_guard.as_mut() {
        if cache.fingerprint == *fingerprint {
            cache.cached_at_ms = AppState::now_ms();
            log::debug!(
                "{} ✓ Cache HIT - returning {} cached packages",
                log_prefix,
                cache.packages.len()
            );
            return Some(cache.packages.clone());
        } else {
            log::debug!(
                "{} Cache fingerprint mismatch. Old: {}, New: {}",
                log_prefix,
                cache.fingerprint,
                fingerprint
            );
        }
    } else {
        log::debug!("{} Cache MISS - no cached data found", log_prefix);
    }
    None
}

async fn update_cache(
    state: &AppState,
    packages: Vec<ScoopPackage>,
    fingerprint: String,
    log_prefix: &str,
) {
    let mut cache_guard = state.installed_packages.lock().await;
    *cache_guard = Some(InstalledPackagesCache {
        packages: packages.clone(),
        fingerprint: fingerprint.clone(),
        cached_at_ms: AppState::now_ms(),
    });
    log::debug!(
        "{} ✓ Cache updated with {} packages",
        log_prefix,
        packages.len()
    );
}

/// Updates the package versions cache to maintain consistency with installed packages cache.
/// This ensures that both caches are always in sync after a refresh.
async fn update_package_versions_cache(
    state: &AppState,
    packages: &[ScoopPackage],
    fingerprint: &str,
) {
    let scoop_path = state.scoop_path();
    let mut versions_map = std::collections::HashMap::new();

    // Build versions map for versioned installs
    for package in packages {
        if matches!(
            package.installation_type,
            crate::models::InstallationType::Versioned | crate::models::InstallationType::Custom
        ) {
            let package_path = scoop_path.join("apps").join(&package.name);
            if let Ok(entries) = fs::read_dir(&package_path) {
                let version_dirs: Vec<String> = entries
                    .flatten()
                    .map(|entry| entry.path())
                    .filter(|path| path.is_dir())
                    .filter_map(|path| path.file_name().and_then(|n| n.to_str()).map(String::from))
                    .filter(|name| name != "current") // Exclude the current symlink
                    .filter(|name| is_valid_version_string(name)) // Only include valid version directories
                    .collect();

                if !version_dirs.is_empty() {
                    versions_map.insert(package.name.clone(), version_dirs);
                }
            }
        }
    }

    // Update the versions cache
    let versions_count = versions_map.len();
    let mut versions_guard = state.package_versions.lock().await;
    *versions_guard = Some(crate::state::PackageVersionsCache {
        fingerprint: fingerprint.to_string(),
        versions_map,
    });

    log::debug!(
        "✓ Package versions cache updated with {} versioned packages",
        versions_count
    );
}

#[tauri::command]
pub async fn get_current_version_install_time<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, AppState>,
    package_name: String,
) -> Result<String, String> {
    let scoop_path = state.scoop_path();
    let apps_path = scoop_path.join("apps");
    let package_path = apps_path.join(&package_name);

    if !package_path.exists() {
        return Err(format!("Package '{}' not found", package_name));
    }

    get_current_version_install_date(&package_path)
}

#[tauri::command]
pub async fn get_current_version_update_date<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, AppState>,
    package_name: String,
) -> Result<String, String> {
    let scoop_path = state.scoop_path();
    let apps_path = scoop_path.join("apps");
    let package_path = apps_path.join(&package_name);

    if !package_path.exists() {
        return Err(format!("Package '{}' not found", package_name));
    }

    get_current_version_update_date_impl(&package_path)
}
