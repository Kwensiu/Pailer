//! Commands for cleaning up Scoop apps and cache.
use crate::commands::auto_cleanup;
use crate::commands::installed::get_installed_packages_full;
use crate::commands::powershell;
use crate::state::AppState;
use tauri::{AppHandle, Emitter, Runtime, State, Window};

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
        operation_id.to_string(),
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
    cleanup_all_apps_smart(window, app, state, Some(true)).await
}

/// Cleans up cache for specific packages using scoop cache rm.
#[tauri::command]
pub async fn remove_cache_for_specific_packages(
    window: Window,
    package_names: Vec<String>,
) -> Result<(), String> {
    log::info!("Running scoop cache rm for specific packages: {:?}", package_names);
    
    if package_names.is_empty() {
        return Ok(());
    }

    let commands = build_cache_rm_commands(&package_names);
    let operation_name = "Cleanup Specific Packages Cache";

    for (index, command) in commands.iter().enumerate() {
        let operation_id = if commands.len() == 1 {
            "cache-specific".to_string()
        } else {
            format!("cache-specific-{}", index + 1)
        };

        run_cleanup_command(window.clone(), command, operation_name, &operation_id).await?;
    }

    Ok(())
}

/// Cleans up all cache using scoop cache rm * command.
#[tauri::command]
pub async fn remove_all_cache_with_scoop(window: Window) -> Result<(), String> {
    log::info!("Running scoop cache rm *");
    run_cleanup_command(
        window,
        "scoop cache rm *",
        "Cleanup All Cache with Scoop",
        "cache-all-scoop",
    )
    .await
}

/// Cleans up old versions of ALL apps, with option to preserve versioned installs.
/// This is equivalent to `scoop cleanup --all` but with intelligence.
#[tauri::command]
pub async fn cleanup_all_apps_smart<R: Runtime>(
    window: Window,
    app: AppHandle<R>,
    state: State<'_, AppState>,
    preserve_versioned: Option<bool>,
) -> Result<(), String> {
    let preserve = preserve_versioned.unwrap_or(true);
    
    if preserve {
        log::info!("Running SMART cleanup of old app versions (preserving versioned installs)");
        
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
            .filter(|pkg| matches!(pkg.installation_type, crate::models::InstallationType::Versioned | crate::models::InstallationType::Custom))
            .count();

        if versioned_count > 0 {
            log::info!(
                "Found {} versioned/custom installs. These will be EXCLUDED from cleanup to preserve specific versions.", 
                versioned_count
            );

            // Get only regular packages (standard installations)
            let regular_packages: Vec<String> = installed_packages
                .iter()
                .filter(|pkg| matches!(pkg.installation_type, crate::models::InstallationType::Standard))
                .map(|pkg| pkg.name.clone())
                .collect();

            if regular_packages.is_empty() {
                log::info!("All packages are versioned installs - no cleanup needed");
                return Ok(());
            }

            log::info!(
                "Running shared smart cleanup for {} regular packages",
                regular_packages.len()
            );

            emit_cleanup_line(
                &window,
                "cleanup-apps",
                format!(
                    "Running smart cleanup for {} regular packages...",
                    regular_packages.len()
                ),
            );

            let result = auto_cleanup::cleanup_old_versions_for_packages(
                &state.scoop_path(),
                &regular_packages,
                0,
            )
            .await;

            finish_cleanup_operation(
                &window,
                "cleanup-apps",
                "Cleanup Old App Versions",
                result,
            )
        } else {
            log::info!("No versioned installs found - running standard cleanup");

            let installed_packages: Vec<String> = installed_packages
                .iter()
                .map(|pkg| pkg.name.clone())
                .collect();

            emit_cleanup_line(
                &window,
                "cleanup-apps",
                format!(
                    "Running smart cleanup for {} installed packages...",
                    installed_packages.len()
                ),
            );

            let result = auto_cleanup::cleanup_old_versions_for_packages(
                &state.scoop_path(),
                &installed_packages,
                0,
            )
            .await;

            finish_cleanup_operation(
                &window,
                "cleanup-apps",
                "Cleanup Old App Versions",
                result,
            )
        }
    } else {
        log::warn!("Running FORCE cleanup of ALL app versions (including versioned installs)");
        run_cleanup_command(
            window,
            "scoop cleanup --all",
            "Force Cleanup All App Versions",
            "cleanup-force",
        )
        .await
    }
}

fn build_cache_rm_commands(package_names: &[String]) -> Vec<String> {
    let max_command_length = 6000;
    let base_command = "scoop cache rm";
    let mut chunks: Vec<Vec<String>> = Vec::new();
    let mut current_chunk = Vec::new();
    let mut current_length = base_command.len();

    for package_name in package_names {
        let quoted_package = auto_cleanup::quote_powershell_arg(package_name);
        let next_length = current_length + quoted_package.len() + 1;

        if !current_chunk.is_empty() && next_length > max_command_length {
            chunks.push(current_chunk);
            current_chunk = Vec::new();
            current_length = base_command.len();
        }

        current_length += quoted_package.len() + 1;
        current_chunk.push(quoted_package);
    }

    if !current_chunk.is_empty() {
        chunks.push(current_chunk);
    }

    chunks
        .into_iter()
        .map(|chunk| format!("{} {}", base_command, chunk.join(" ")))
        .collect()
}

fn emit_cleanup_line(window: &Window, operation_id: &str, line: String) {
    if let Err(error) = window.emit(
        powershell::EVENT_OUTPUT,
        powershell::StreamOutput {
            operation_id: operation_id.to_string(),
            line,
            source: "stdout".to_string(),
        },
    ) {
        log::warn!("Failed to emit cleanup output: {}", error);
    }
}

fn finish_cleanup_operation(
    window: &Window,
    operation_id: &str,
    operation_name: &str,
    result: Result<(), String>,
) -> Result<(), String> {
    let (success, error_message) = match result {
        Ok(()) => (true, None),
        Err(error) => (false, Some(error)),
    };

    if let Some(error_message) = &error_message {
        emit_cleanup_line(window, operation_id, format!("Error: {}", error_message));
    }

    if let Err(error) = window.emit(
        powershell::EVENT_FINISHED,
        powershell::CommandResult {
            success,
            operation_id: operation_id.to_string(),
            operation_name: operation_name.to_string(),
            error_count: if success { None } else { Some(1) },
            warning_count: None,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
        },
    ) {
        log::warn!("Failed to emit cleanup finished event: {}", error);
    }

    match error_message {
        Some(error_message) => Err(error_message),
        None => Ok(()),
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
        .filter(|pkg| matches!(pkg.installation_type, crate::models::InstallationType::Standard))
        .map(|pkg| pkg.name.clone())
        .collect();

    if safe_packages.is_empty() {
        log::info!("No packages found that are safe for cache cleanup");
        return Ok(());
    }

    // Build the scoop cache rm command for specific packages
    let packages_str = safe_packages.join(" ");
    let command = format!("scoop cache rm {}", packages_str);

    log::info!("Running cache cleanup for packages: {}", packages_str);
    run_cleanup_command(window, &command, "Cleanup Outdated App Caches", "cleanup-cache").await
}