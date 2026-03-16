//! Commands for managing versioned installations.
use crate::commands::installed::get_installed_packages_full;
use crate::state::AppState;
use serde::Serialize;
use std::fs;
use std::path::Path;
use std::fs::read_link;
use tauri::{AppHandle, Runtime, State};

/// Represents a versioned application.
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VersionedApp {
    pub name: String,
    pub current_version: String,
    pub local_versions: Vec<String>,
    pub bucket: String,
    pub is_versioned_install: bool,
}

/// Gets all applications with version directories (not just versioned installs).
#[tauri::command]
pub async fn get_versioned_apps<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, AppState>,
) -> Result<Vec<VersionedApp>, String> {
    log::info!("Getting applications with version directories...");

    let scoop_path = state.scoop_path();
    let apps_path = scoop_path.join("apps");

    if !apps_path.is_dir() {
        log::warn!("Apps directory not found at: {:?}", apps_path);
        return Ok(vec![]);
    }

    // Get all installed packages
    let installed_packages = get_installed_packages_full(app.clone(), state).await?;
    
    // Filter packages that have multiple version directories (regardless of installation type)
    let packages_with_versions: Vec<_> = installed_packages
        .iter()
        .filter(|pkg| pkg.has_multiple_versions)
        .collect();

    let mut versioned_apps = Vec::new();

    for package in packages_with_versions {
        let package_path = apps_path.join(&package.name);
        
        if let Ok(entries) = fs::read_dir(&package_path) {
            // Get all version directories
            let local_versions: Vec<String> = entries
                .flatten()
                .map(|entry| entry.path())
                .filter(|path| path.is_dir())
                .filter_map(|path| path.file_name().and_then(|n| n.to_str()).map(String::from))
                .filter(|name| name != "current") // Exclude the current symlink
                .filter(|name| is_valid_version_string(name))
                .collect();

            // Get current version by reading the 'current' symlink
            let current_version = get_current_version(&package_path).unwrap_or_else(|| "unknown".to_string());

            if !local_versions.is_empty() {
                versioned_apps.push(VersionedApp {
                    name: package.name.clone(),
                    current_version,
                    local_versions,
                    bucket: package.source.clone(),
                    is_versioned_install: matches!(package.installation_type, crate::models::InstallationType::Versioned),
                });
            }
        }
    }

    log::info!("Found {} applications with version directories", versioned_apps.len());
    Ok(versioned_apps)
}

/// Deletes a specific version of an application.
#[tauri::command]
pub async fn delete_app_version<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, AppState>,
    app_name: String,
    version: String,
) -> Result<(), String> {
    log::info!("Deleting version '{}' of app '{}'", version, app_name);

    let scoop_path = state.scoop_path();
    let apps_path = scoop_path.join("apps");
    let app_path = apps_path.join(&app_name);
    let version_path = app_path.join(&version);
    let current_path = app_path.join("current");

    // Check if it's the current version
    if current_path.exists() {
        match read_link(&current_path) {
            Ok(symlink_target) => {
                // Check if the symlink points to the version we want to delete
                if symlink_target.ends_with(&version) {
                    return Err("Cannot delete the currently active version. Switch to another version first.".to_string());
                }
            }
            Err(_) => {
                log::warn!("Current symlink exists but cannot be read for app '{}'", app_name);
                // Continue with deletion - broken symlink shouldn't prevent deletion
            }
        }
    }

    if !version_path.is_dir() {
        return Err(format!("Version '{}' not found for app '{}'", version, app_name));
    }

    // Remove the version directory
    fs::remove_dir_all(&version_path).map_err(|e| {
        format!("Failed to remove version directory: {}", e)
    })?;

	// Invalidate caches so the UI doesn't see stale version data
	{
		let mut versions_guard = state.package_versions.lock().await;
		*versions_guard = None;
	}
	{
		let mut installed_guard = state.installed_packages.lock().await;
		*installed_guard = None;
	}

    log::info!("Successfully deleted version '{}' of app '{}'", version, app_name);
    Ok(())
}

/// Switches an application to a specific version.
#[tauri::command]
pub async fn switch_app_version<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, AppState>,
    app_name: String,
    target_version: String,
) -> Result<(), String> {
    log::info!("Switching app '{}' to version '{}'", app_name, target_version);

    let scoop_path = state.scoop_path();
    let apps_path = scoop_path.join("apps");
    let app_path = apps_path.join(&app_name);
    let target_path = app_path.join(&target_version);
    let current_path = app_path.join("current");

    if !target_path.is_dir() {
        return Err(format!("Target version '{}' not found for app '{}'", target_version, app_name));
    }

    // Remove existing current symlink/directory
    if current_path.exists() {
        // Check if it's a symlink or directory
        match current_path.metadata() {
            Ok(metadata) => {
                if metadata.file_type().is_symlink() {
                    fs::remove_file(&current_path).map_err(|e| {
                        format!("Failed to remove existing current symlink: {}", e)
                    })?;
                } else if metadata.is_dir() {
                    // It's a directory, remove it
                    fs::remove_dir_all(&current_path).map_err(|e| {
                        format!("Failed to remove existing current directory: {}", e)
                    })?;
                } else {
                    // It's a file, remove it
                    fs::remove_file(&current_path).map_err(|e| {
                        format!("Failed to remove existing current file: {}", e)
                    })?;
                }
            }
            Err(e) => {
                return Err(format!("Failed to get metadata for current path: {}", e));
            }
        }
    }

    // Creates new symlink on Windows
    std::os::windows::fs::symlink_dir(&target_path, &current_path).map_err(|e| {
        format!("Failed to create directory symlink: {}", e)
    })?;

    log::info!("Successfully switched '{}' to version '{}'", app_name, target_version);
    Ok(())
}

/// Removes versioned applications completely.
#[tauri::command]
pub async fn remove_versioned_apps<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, AppState>,
    app_names: Vec<String>,
) -> Result<(), String> {
    log::info!("Removing {} versioned apps: {:?}", app_names.len(), app_names);

    let scoop_path = state.scoop_path();
    
    for app_name in &app_names {
        let app_path = scoop_path.join("apps").join(app_name);
        
        if app_path.exists() {
            // Remove the entire app directory
            fs::remove_dir_all(&app_path).map_err(|e| {
                format!("Failed to remove app directory '{}': {}", app_name, e)
            })?;
            
            log::info!("Removed versioned app: {}", app_name);
        } else {
            log::warn!("App directory not found for removal: {}", app_name);
        }
    }

    log::info!("Successfully removed {} versioned apps", app_names.len());
    Ok(())
}

/// Gets the current version of an app by reading the 'current' symlink.
fn get_current_version(app_path: &Path) -> Option<String> {
    let current_path = app_path.join("current");
    
    if !current_path.exists() {
        return None;
    }

    // Check if it's a valid symlink
    if !current_path.is_symlink() {
        log::warn!("Current path exists but is not a symlink: {:?}", current_path);
        return None;
    }

    match read_link(&current_path) {
        Ok(path) => {
            path.file_name()
                .and_then(|n| n.to_str())
                .map(String::from)
                .filter(|s| is_valid_version_string(s))
        }
        Err(e) => {
            log::warn!("Failed to read symlink {:?}: {}", current_path, e);
            None
        }
    }
}

/// Checks if a string represents a valid version format.
fn is_valid_version_string(version: &str) -> bool {
    !version.is_empty() 
        && version.chars().any(|c| c.is_ascii_digit())
        && !version.starts_with('.') // Avoid directories starting with dot
        && version.len() <= 50 // Reasonable length limit
}
