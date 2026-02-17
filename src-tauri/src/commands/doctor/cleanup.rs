//! Commands for cleaning up Scoop apps and cache.
use crate::commands::installed::get_installed_packages_full;
use crate::commands::powershell;
use crate::state::AppState;
use tauri::{AppHandle, Runtime, State, Window};

/// Runs a specific Scoop cleanup command and streams its output.
///
/// # Arguments
/// * `window` - The Tauri window to emit events to.
/// * `command` - The full `scoop cleanup` command to execute.
/// * `operation_name` - A descriptive name for the operation being performed.
/// * `operation_id` - The unique identifier for this operation.
async fn run_cleanup_command(
    window: Window,
    command: &str,
    operation_name: &str,
    operation_id: &str,
) -> Result<(), String> {
    log::info!("Executing cleanup command: {}", command);
    
    let result = powershell::run_and_stream_command(
        window,
        command.to_string(),
        operation_name.to_string(),
        powershell::EVENT_OUTPUT,
        powershell::EVENT_FINISHED,
        powershell::EVENT_CANCEL,
        Some(operation_id.to_string()),
    )
    .await;
    
    match &result {
        Ok(_) => log::info!("Successfully completed cleanup command: {}", command),
        Err(e) => log::error!("Failed to execute cleanup command '{}': {}", command, e),
    }
    
    result
}

/// Cleans up old versions of all installed apps, with an option to include/exclude versioned installs.
#[tauri::command]
pub async fn cleanup_all_apps<R: Runtime>(
    window: Window,
    app: AppHandle<R>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    log::info!("Running cleanup of old app versions");

    // Get all installed packages to identify versioned installs
    let installed_packages_result = get_installed_packages_full(app, state.clone()).await;
    
    let installed_packages = match installed_packages_result {
        Ok(packages) => {
            log::info!("Successfully retrieved {} installed packages", packages.len());
            packages
        },
        Err(e) => {
            log::error!("Failed to retrieve installed packages: {}", e);
            return Err(format!("Failed to retrieve installed packages: {}", e));
        }
    };

    // Count versioned installs for logging
    let versioned_count = installed_packages
        .iter()
        .filter(|pkg| pkg.is_versioned_install)
        .count();

    if versioned_count > 0 {
        log::warn!(
            "Found {} versioned installs. These will be EXCLUDED from cleanup to preserve specific versions.", 
            versioned_count
        );

        // Get only regular packages (non-versioned installs)
        let regular_packages: Vec<String> = installed_packages
            .iter()
            .filter(|pkg| !pkg.is_versioned_install)
            .map(|pkg| pkg.name.clone())
            .collect();

        if regular_packages.is_empty() {
            log::info!("All packages are versioned installs - no cleanup needed");
            return Ok(());
        }

        // Clean up only regular packages
        let packages_str = regular_packages.join(" ");
        let command = format!("scoop cleanup {}", packages_str);

        log::info!(
            "Running selective cleanup for {} regular packages",
            regular_packages.len()
        );
        run_cleanup_command(window, &command, "Cleanup Old App Versions", "cleanup-apps").await
    } else {
        log::info!("No versioned installs found - running standard cleanup");
        run_cleanup_command(window, "scoop cleanup --all", "Cleanup Old App Versions", "cleanup-apps").await
    }
}

/// Cleans up old versions of ALL apps, including versioned installs (DANGEROUS).
/// This is equivalent to the original `scoop cleanup --all` command.
#[tauri::command]
pub async fn cleanup_all_apps_force(window: Window) -> Result<(), String> {
    log::warn!("Running FORCE cleanup of ALL app versions (including versioned installs)");
    run_cleanup_command(
        window,
        "scoop cleanup --all",
        "Force Cleanup All App Versions",
        "cleanup-force",
    )
    .await
}

/// Cleans up the download cache for apps, but preserves cache for versioned installs.
#[tauri::command]
pub async fn cleanup_outdated_cache<R: Runtime>(
    window: Window,
    app: AppHandle<R>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    log::info!("Running version-aware cleanup of outdated app caches");

    // Get all installed packages to identify versioned installs
    let installed_packages_result = get_installed_packages_full(app, state.clone()).await;
    
    let installed_packages = match installed_packages_result {
        Ok(packages) => {
            log::info!("Successfully retrieved {} installed packages for cache cleanup", packages.len());
            packages
        },
        Err(e) => {
            log::error!("Failed to retrieve installed packages for cache cleanup: {}", e);
            return Err(format!("Failed to retrieve installed packages: {}", e));
        }
    };

    // Collect packages that are NOT versioned installs (safe to clean cache)
    let safe_packages: Vec<String> = installed_packages
        .iter()
        .filter(|pkg| !pkg.is_versioned_install)
        .map(|pkg| pkg.name.clone())
        .collect();

    if safe_packages.is_empty() {
        log::info!("No packages found that are safe for cache cleanup");
        return Ok(());
    }

    // Build the scoop cleanup cache command for specific packages
    let packages_str = safe_packages.join(" ");
    let command = format!("scoop cleanup {} --cache", packages_str);

    log::info!("Running cache cleanup for packages: {}", packages_str);
    run_cleanup_command(window, &command, "Cleanup Outdated App Caches", "cleanup-cache").await
}