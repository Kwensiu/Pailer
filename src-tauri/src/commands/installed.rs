//! Command for fetching all installed Scoop packages from the filesystem.
use crate::models::{InstallManifest, PackageManifest, ScoopPackage};
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

    log::info!(
        "Searching for package bucket. Scoop path: {}, Package name: {}",
        scoop_path.display(),
        package_name
    );

    if let Ok(buckets) = fs::read_dir(&buckets_path) {
        for bucket_entry in buckets.flatten() {
            if bucket_entry.path().is_dir() {
                let bucket_name = bucket_entry.file_name().to_string_lossy().to_string();
                // Look in the correct path: buckets/{bucket}/bucket/{package}.json
                let manifest_path = bucket_entry
                    .path()
                    .join("bucket")
                    .join(format!("{}.json", package_name));

                log::debug!(
                    "Checking bucket: {}, manifest path: {}",
                    bucket_name,
                    manifest_path.display()
                );
                if manifest_path.exists() {
                    log::info!("Found package {} in bucket {}", package_name, bucket_name);
                    return Some(bucket_name);
                }
            }
        }
    }

    // Fallback: check if it's in the main bucket (which might not be in buckets dir)
    log::info!("Package {} not found in any bucket", package_name);
    None
}

/// Returns the most recently updated version directory for a package when the
/// `current` link is missing.
fn find_latest_version_dir(package_path: &Path) -> Option<PathBuf> {
    let mut candidates: Vec<(u128, PathBuf)> = Vec::new();

    log::info!(
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
    log::info!(
        "Latest version directory found: {:?}",
        result.as_ref().map(|p| p.display().to_string())
    );
    result
}

fn locate_install_dir(package_path: &Path) -> Result<PathBuf, String> {
    let package_name = extract_package_name(package_path)?;
    let current_path = package_path.join("current");

    if current_path.is_dir() {
        log::debug!("Found current directory for package: {}", package_name);
        Ok(current_path)
    } else if let Some(fallback_dir) = find_latest_version_dir(package_path) {
        log::info!(
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
    let entries: Vec<String> = app_dirs
        .iter()
        .filter_map(|path| {
            path.file_name().and_then(|n| n.to_str()).map(|name| {
                let modified_stamp = match locate_install_dir(path) {
                    Ok(install_dir) => get_install_modification_time(&install_dir),
                    Err(_) => get_path_modification_time(path),
                };
                
                format!("{}:{}", name.to_ascii_lowercase(), modified_stamp)
            })
        })
        .collect();

    let mut sorted_entries = entries;
    sorted_entries.sort();
    let fingerprint = format!("{}|{}", app_dirs.len(), sorted_entries.join(";"));
    log::debug!("Computed apps fingerprint: {}", fingerprint);
    fingerprint
}

/// Attempts to load manifest.json and install.json with various fallback strategies.
fn load_manifests_with_fallback(
    install_root: &Path, 
    package_name: &str
) -> Result<(PackageManifest, InstallManifest), String> {
    // Try to read manifest.json
    let manifest_path = install_root.join("manifest.json");
    log::debug!(
        "Reading manifest.json for package: {}",
        package_name
    );
    
    let manifest = if manifest_path.exists() {
        let manifest_content = fs::read_to_string(&manifest_path)
            .map_err(|e| format!("Failed to read manifest.json for {}: {}", package_name, e))?;
        serde_json::from_str(&manifest_content)
            .map_err(|e| format!("Failed to parse manifest.json for {}: {}", package_name, e))?
    } else {
        // Create minimal manifest if file doesn't exist
        log::warn!("manifest.json not found for {}, creating minimal manifest", package_name);
        PackageManifest {
            version: "unknown".to_string(),
            description: Some(format!("Package: {}", package_name)),
            ..Default::default()
        }
    };

    // Try to read install.json
    let install_manifest_path = install_root.join("install.json");
    log::debug!(
        "Reading install.json for package: {}",
        package_name
    );
    
    let install_manifest = if install_manifest_path.exists() {
        let install_manifest_content = fs::read_to_string(&install_manifest_path)
            .map_err(|e| format!("Failed to read install.json for {}: {}", package_name, e))?;
        serde_json::from_str(&install_manifest_content)
            .map_err(|e| format!("Failed to parse install.json for {}: {}", package_name, e))?
    } else {
        // Create minimal install manifest if file doesn't exist
        log::warn!("install.json not found for {}, creating minimal manifest", package_name);
        InstallManifest {
            bucket: None, // This indicates a custom/unknown installation
            ..Default::default()
        }
    };

    Ok((manifest, install_manifest))
}


/// Attempts to extract version information from directory structure or files.
fn extract_version_from_directory(install_root: &Path) -> Option<String> {
    // Try to get version from parent directory name (version directories)
    if let Some(dir_name) = install_root.file_name().and_then(|n| n.to_str()) {
        // Check if directory name looks like a version (e.g., "1.2.3")
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
                            let package_name = install_root.file_name()
                                .and_then(|n| n.to_str())
                                .unwrap_or("unknown");
                            log::warn!("Failed to parse JSON file in package {}: {}", package_name, e);
                            // Continue processing other files, don't return error
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
    
    // Simple validation: contains at least one digit and no invalid characters
    let has_digit = s.chars().any(|c| c.is_ascii_digit());
    let has_invalid_chars = s.chars().any(|c| !c.is_ascii_alphanumeric() && c != '.' && c != '-' && c != '_');
    
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


/// Loads package manifest and install manifest with fallback strategies.
fn load_package_info(install_root: &Path, package_name: &str) -> Result<(PackageManifest, InstallManifest), String> {
    match load_manifests_with_fallback(install_root, package_name) {
        Ok(result) => Ok(result),
        Err(e) => {
            log::warn!("Failed to load manifests for {}: {}, creating fallback manifests", package_name, e);
            let version = extract_version_from_directory(install_root).unwrap_or_else(|| "unknown".to_string());
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
        }
    }
}

/// Determines the bucket for a package, with intelligent fallback logic.
fn determine_bucket(install_manifest: &InstallManifest, scoop_path: &Path, package_name: &str) -> String {
    if let Some(ref bucket_name) = install_manifest.bucket {
        // Normal bucket installation
        bucket_name.clone()
    } else {
        // Custom or unknown installation - try to find in buckets first
        match find_package_bucket(scoop_path, package_name) {
            Some(found_bucket) => {
                log::debug!("Found package {} in bucket: {}", package_name, found_bucket);
                found_bucket
            }
            None => {
                // Truly custom installation
                log::debug!("Package {} appears to be custom installed, marking as Custom", package_name);
                "Custom".to_string()
            }
        }
    }
}

/// Gets the installation/update time from the install root directory.
fn get_install_time(install_root: &Path) -> String {
    fs::metadata(install_root)
        .and_then(|m| m.modified())
        .map(|t| DateTime::<Utc>::from(t).to_rfc3339())
        .unwrap_or_default()
}

/// Builds a ScoopPackage from the collected information.
fn build_scoop_package(package_name: String, manifest: PackageManifest, bucket: String, updated_time: String, has_version_dirs: bool) -> ScoopPackage {
    let is_versioned_install = if bucket == "Custom" { has_version_dirs } else { false };
    
    ScoopPackage {
        name: package_name,
        version: manifest.version,
        source: bucket,
        updated: updated_time,
        is_installed: true,
        info: manifest.description.unwrap_or_default(),
        is_versioned_install,
        ..Default::default()
    }
}

/// Loads the details for a single installed package from its directory.
/// Uses enhanced error recovery to handle various installation scenarios.
fn load_package_details(package_path: &Path, scoop_path: &Path) -> Result<ScoopPackage, String> {
    let package_name = extract_package_name(package_path)?;
    log::debug!("Loading package details for: {}", package_name);

    // Check if this package has version directories (indicating versioned install)
    let has_version_dirs = fs::read_dir(package_path)
        .ok()
        .map(|entries| entries
            .flatten()
            .filter(|entry| entry.path().is_dir())
            .filter_map(|entry| entry.file_name().to_str().map(|s| s.to_string()))
            .any(|name| name != "current" && is_valid_version_string(&name))
        )
        .unwrap_or(false);

    let install_root = locate_install_dir(package_path)?;
    let (manifest, install_manifest) = load_package_info(&install_root, &package_name)?;
    let bucket = determine_bucket(&install_manifest, scoop_path, &package_name);
    let updated_time = get_install_time(&install_root);

    log::debug!("Determined bucket for package {}: {}", package_name, bucket);

    Ok(build_scoop_package(package_name, manifest, bucket, updated_time, has_version_dirs))
}

/// Fetches a list of all installed Scoop packages by scanning the filesystem.
async fn refresh_scoop_path_if_needed<R: Runtime>(
    app: AppHandle<R>,
    state: &AppState,
    reason: &str,
) -> Option<PathBuf> {
    let current_path = state.scoop_path();
    log::info!(
        "Refreshing scoop path if needed. Current path: {}, reason: {}",
        current_path.display(),
        reason
    );

    match crate::utils::resolve_scoop_root(app) {
        Ok(new_path) => {
            if current_path != new_path {
                log::info!(
                    "Scoop path updated from '{}' to '{}' ({})",
                    current_path.display(),
                    new_path.display(),
                    reason
                );
                state.set_scoop_path(new_path.clone());
                let mut cache_guard = state.installed_packages.lock().await;
                *cache_guard = None;
                return Some(new_path);
            }
            Some(current_path)
        }
        Err(err) => {
            log::warn!("Failed to refresh Scoop path ({}): {}", reason, err);
            None
        }
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
    log::debug!("{} Computed fingerprint: {}", log_prefix, fingerprint);

    // Get scoop path for use in package loading
    let scoop_path = state.scoop_path();

    // Check cache
    if let Some(cached_packages) = check_cache(state, &fingerprint, log_prefix).await {
        return Ok(cached_packages);
    }

    log::info!(
        "{} Scanning {} installed package directories from filesystem",
        log_prefix,
        app_dirs.len()
    );

    let packages: Vec<ScoopPackage> = app_dirs
        .par_iter()
        .filter_map(
            |path| match load_package_details(path.as_path(), &scoop_path) {
                Ok(package) => {
                    log::debug!("Successfully loaded package: {}", package.name);
                    Some(package)
                }
                Err(e) => {
                    let package_name = path.file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("unknown");
                    log::warn!(
                        "{} Skipping package '{}': {}",
                        log_prefix,
                        package_name,
                        e
                    );
                    None
                }
            },
        )
        .collect();

    log::info!(
        "{} ✓ Scanned {} packages, found {} valid packages",
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

#[tauri::command]
pub async fn get_installed_packages_full<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, AppState>,
) -> Result<Vec<ScoopPackage>, String> {
    log::info!("=== INSTALLED SCAN === get_installed_packages_full called");

    // Perform the scan (cache is checked inside)
    let result = scan_installed_packages_internal(app, &state, false).await;
    log::info!(
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

    log::info!(
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
) -> Result<Vec<ScoopPackage>, String> {
    log::info!("=== INSTALLED REFRESH === refresh_installed_packages called");

    // Check if we should debounce this refresh call
    if state.should_debounce_refresh() {
        log::debug!(
            "=== INSTALLED REFRESH === Debouncing refresh (less than 1 second since last refresh)"
        );
        // Return cached results without rescanning
        let cache_guard = state.installed_packages.lock().await;
        if let Some(cache) = cache_guard.as_ref() {
            log::info!("=== INSTALLED REFRESH === Returning cached packages due to debounce");
            return Ok(cache.packages.clone());
        }
    }

    state.update_refresh_time();

    // First invalidate cache to ensure fresh data
    log::info!("=== INSTALLED REFRESH === Invalidating cache");
    invalidate_installed_cache(state.clone()).await;

    // Then fetch fresh data
    log::info!("=== INSTALLED REFRESH === Fetching fresh data");
    let result = scan_installed_packages_internal(app, &state, false).await;
    
    log::info!("=== INSTALLED REFRESH === refresh_installed_packages completed");
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
            log::info!("{} Path refreshed to: {}", log_prefix, apps_path.display());
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
    let cache_guard = state.installed_packages.lock().await;
    if let Some(cache) = cache_guard.as_ref() {
        if cache.fingerprint == *fingerprint {
            log::info!(
                "{} ✓ Cache HIT - returning {} cached packages",
                log_prefix,
                cache.packages.len()
            );
            return Some(cache.packages.clone());
        } else {
            log::info!(
                "{} Cache fingerprint mismatch. Old: {}, New: {}",
                log_prefix,
                cache.fingerprint,
                fingerprint
            );
        }
    } else {
        log::info!("{} Cache MISS - no cached data found", log_prefix);
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
    });
    log::info!(
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
        if package.is_versioned_install {
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
    
    log::info!(
        "✓ Package versions cache updated with {} versioned packages",
        versions_count
    );
}
