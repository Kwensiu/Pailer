//! Commands for managing the Scoop cache.
use crate::commands::installed::get_installed_packages_full;
use crate::state::AppState;
use rayon::prelude::*;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use tauri::{AppHandle, Manager, Runtime, State};

/// Represents a single entry in the Scoop cache.
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CacheEntry {
    pub name: String,
    pub version: String,
    pub length: u64,
    pub file_name: String,
    pub is_versioned_install: bool,
    pub is_safe_to_delete: bool,
}

/// Gets local version directories for versioned packages.
/// Returns a map of package name -> list of local version strings.
fn get_local_versions_for_versioned_packages<R: Runtime>(
    app: AppHandle<R>,
    installed_packages: &[crate::models::ScoopPackage],
) -> Result<HashMap<String, Vec<String>>, String> {
    let scoop_path = app.state::<AppState>().scoop_path();
    let mut versions_map = HashMap::new();
    
    log::info!("Scanning local versions for versioned packages...");
    
    // Build versions map for versioned installs
    for package in installed_packages {
        if matches!(package.installation_type, crate::models::InstallationType::Versioned | crate::models::InstallationType::Custom) {
            let package_path = scoop_path.join("apps").join(&package.name);
            log::info!("Scanning versions for versioned package '{}' at: {:?}", package.name, package_path);
            
            if let Ok(entries) = fs::read_dir(&package_path) {
                let version_dirs: Vec<String> = entries
                    .flatten()
                    .map(|entry| entry.path())
                    .filter(|path| path.is_dir())
                    .filter_map(|path| path.file_name().and_then(|n| n.to_str()).map(String::from))
                    .filter(|name| name != "current") // Exclude the current symlink
                    .filter(|name| is_valid_version_string(name)) // Only include valid version directories
                    .collect();
                
                log::info!("Found {} version directories for '{}': {:?}", version_dirs.len(), package.name, version_dirs);
                
                if !version_dirs.is_empty() {
                    versions_map.insert(package.name.clone(), version_dirs);
                }
            } else {
                log::warn!("Failed to read directory for package '{}': {:?}", package.name, package_path);
            }
        }
    }
    
    log::info!("Built local versions map for {} packages", versions_map.len());
    Ok(versions_map)
}

/// Checks if a string represents a valid version format.
fn is_valid_version_string(version: &str) -> bool {
    !version.is_empty() 
        && version.chars().any(|c| c.is_ascii_digit())
        && !version.starts_with('.') // Avoid directories starting with dot
        && version.len() <= 50 // Reasonable length limit
}

/// Parses a `CacheEntry` from a given file path.
///
/// The file name is expected to be in the format `name#version#hash.ext`.
fn parse_cache_entry_from_path(
    path: &Path,
    versioned_packages: &HashSet<String>,
) -> Option<CacheEntry> {
    let file_name = path.file_name()?.to_str()?.to_string();

    let parts: Vec<&str> = file_name.split('#').collect();
    if parts.len() < 2 {
        log::warn!("Skipping cache file with unexpected format: {}", file_name);
        return None;
    }

    let metadata = fs::metadata(path).ok()?;
    if !metadata.is_file() {
        return None;
    }

    let package_name = parts[0].to_string();
    let is_versioned_install = versioned_packages.contains(&package_name);

    Some(CacheEntry {
        name: package_name,
        version: parts[1].to_string(),
        length: metadata.len(),
        file_name,
        is_versioned_install,
        is_safe_to_delete: !is_versioned_install,
    })
}

/// Lists all entries in the Scoop cache directory with version-awareness.
///
/// This function reads the cache directory, parses each file to extract cache information,
/// and returns a sorted list of cache entries with safety information.
#[tauri::command]
pub async fn list_cache_contents<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, AppState>,
    preserve_versioned: bool,
) -> Result<Vec<CacheEntry>, String> {
    log::info!("Listing cache contents from filesystem with version-awareness");

    let scoop_path = state.scoop_path();
    let cache_path = scoop_path.join("cache");

    if !cache_path.is_dir() {
        log::warn!("Scoop cache directory not found at: {:?}", cache_path);
        return Ok(vec![]);
    }

    // Get all installed packages to identify versioned installs
    let installed_packages = get_installed_packages_full(app.clone(), state.clone()).await?;
    
    // Add logging to observe installation type identification process
    log::info!("Total installed packages: {}", installed_packages.len());
    for pkg in &installed_packages {
        log::info!("Package '{}' from bucket '{}' - installation_type: {:?}, has_multiple_versions: {}", 
                  pkg.name, pkg.source, pkg.installation_type, pkg.has_multiple_versions);
    }
    
    // Fix: Use explicit installation type judgment logic
    // Versioned installs (from versions bucket) and custom installs (from Custom bucket) need cache protection
    // Regular installs with multiple version directories don't protect cache (might be backup directories)
    let versioned_packages: HashSet<String> = installed_packages
        .iter()
        .filter(|pkg| matches!(pkg.installation_type, crate::models::InstallationType::Versioned | crate::models::InstallationType::Custom))
        .map(|pkg| pkg.name.clone())
        .collect();
    
    log::info!("Identified {} packages with versioned/custom installation for cache protection: {:?}", 
              versioned_packages.len(), versioned_packages);

    let read_dir =
        fs::read_dir(&cache_path).map_err(|e| format!("Failed to read cache directory: {}", e))?;

    let mut entries: Vec<CacheEntry> = read_dir
        .par_bridge()
        .filter_map(Result::ok)
        .filter_map(|entry| parse_cache_entry_from_path(&entry.path(), &versioned_packages))
        .collect();

    entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    // If preserve_versioned is enabled, filter out cache entries that match local versions
    if preserve_versioned {
        log::info!("Applying preserve_versioned filter...");
        let local_versions = get_local_versions_for_versioned_packages(app.clone(), &installed_packages)?;
        
        let original_count = entries.len();
        entries.retain(|entry| {
            if let Some(local_version_list) = local_versions.get(&entry.name) {
                // Versioned install: only show versions not present locally
                let should_keep = !local_version_list.contains(&entry.version);
                log::debug!("Cache entry '{}@{}' - local versions: {:?}, should keep: {}", 
                          entry.name, entry.version, local_version_list, should_keep);
                should_keep
            } else {
                // Non-versioned install: show all cache entries
                log::debug!("Cache entry '{}@{}' - non-versioned install, keeping", entry.name, entry.version);
                true
            }
        });
        
        log::info!("Preserve_versioned filter: {} -> {} entries (removed {})", 
                  original_count, entries.len(), original_count - entries.len());
    }

    log::info!(
        "Found {} cache entries, {} are versioned installs",
        entries.len(),
        entries.iter().filter(|e| e.is_versioned_install).count()
    );

    Ok(entries)
}

/// Clears specified files or the entire Scoop cache, with version-awareness.
/// Returns (success_count, failure_count) indicating how many files were successfully processed.
/// When preserve_versioned is true, skips cache files for versioned installs.
///
/// # Arguments
/// * `files` - An optional vector of file names to remove. If `None`, only non-versioned cache is cleared.
/// * `preserve_versioned` - If true, skips cache for versioned installs.
#[tauri::command]
pub async fn clear_cache<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, AppState>,
    files: Option<Vec<String>>,
    preserve_versioned: bool,
) -> Result<(usize, usize), String> {
    log::info!(
        "Clearing cache from filesystem with version-awareness. Files: {:?}",
        &files
    );

    let scoop_path = state.scoop_path();
    let cache_path = scoop_path.join("cache");

    if !cache_path.is_dir() {
        return Ok((0, 0));
    }

    // Get versioned packages to avoid deleting their cache
    let installed_packages = get_installed_packages_full(app.clone(), state).await?;
    let versioned_packages: HashSet<String> = installed_packages
        .iter()
        .filter(|pkg| matches!(pkg.installation_type, crate::models::InstallationType::Versioned | crate::models::InstallationType::Custom))
        .map(|pkg| pkg.name.clone())
        .collect();

    // Validate that all files to delete exist in cache before proceeding
    if let Some(ref files_to_delete) = files {
        let invalid_files: Vec<String> = files_to_delete
            .iter()
            .filter(|file_name| !cache_path.join(file_name).is_file())
            .cloned()
            .collect();
        
        if !invalid_files.is_empty() {
            log::warn!("Some cache files not found: {:?}", invalid_files);
        }
    }

    match files {
        Some(files_to_delete) if !files_to_delete.is_empty() => {
            clear_specific_files_safe(&cache_path, &files_to_delete, &versioned_packages, preserve_versioned)
        }
        _ => clear_safe_cache(&cache_path, &versioned_packages, preserve_versioned),
    }
}

/// Removes a specific list of files from the cache directory, optionally avoiding versioned installs.
/// Returns (success_count, failure_count)
fn clear_specific_files_safe(
    cache_path: &Path,
    files_to_delete: &[String],
    versioned_packages: &HashSet<String>,
    preserve_versioned: bool,
) -> Result<(usize, usize), String> {
    log::info!(
        "Clearing {} specified cache files (avoiding versioned installs).",
        files_to_delete.len()
    );

    let mut success_count = 0;
    let mut failure_count = 0;

    for file_name in files_to_delete {
        // Parse the package name from the cache file name (format: name#version#hash.ext)
        if preserve_versioned {
            if let Some(package_name) = file_name.split('#').next() {
                if versioned_packages.contains(package_name) {
                    log::info!("Skipping cache file for versioned install: {}", file_name);
                    success_count += 1; // Count as success since we intentionally skipped it
                    continue;
                }
            }
        }

        let file_path = cache_path.join(file_name);
        if file_path.is_file() {
            match fs::remove_file(&file_path) {
                Ok(()) => {
                    log::debug!("Deleted cache file: {}", file_name);
                    success_count += 1;
                }
                Err(e) => {
                    log::error!("Failed to delete cache file {}: {}", file_name, e);
                    failure_count += 1;
                }
            }
        } else {
            log::debug!("File not found: {}", file_name);
            success_count += 1; // Count as success since file is already gone
        }
    }

    Ok((success_count, failure_count))
}

/// Removes all non-versioned files from the cache directory.
/// Returns (success_count, failure_count)
fn clear_safe_cache(cache_path: &Path, versioned_packages: &HashSet<String>, preserve_versioned: bool) -> Result<(usize, usize), String> {
    log::info!("Clearing cache directory (avoiding versioned installs).");

    let dir_entries = fs::read_dir(cache_path).map_err(|e| format!("Failed to read cache directory: {}", e))?;
    
    let mut success_count = 0;
    let mut failure_count = 0;

    for entry in dir_entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            let should_delete = if preserve_versioned {
                if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                    if let Some(package_name) = file_name.split('#').next() {
                        !versioned_packages.contains(package_name)
                    } else {
                        true
                    }
                } else {
                    true
                }
            } else {
                true
            };

            if should_delete {
                match fs::remove_file(&path) {
                    Ok(()) => {
                        log::debug!("Deleted cache file: {:?}", path.file_name());
                        success_count += 1;
                    }
                    Err(e) => {
                        log::error!("Failed to delete cache file {:?}: {}", path.file_name(), e);
                        failure_count += 1;
                    }
                }
            } else {
                log::debug!("Skipping cache file for versioned install: {:?}", path.file_name());
                success_count += 1; // Count skipped files as success
            }
        }
    }

    Ok((success_count, failure_count))
}
