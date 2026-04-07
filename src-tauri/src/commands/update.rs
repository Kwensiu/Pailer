use crate::commands::auto_cleanup::trigger_auto_cleanup;
use crate::commands::installed::{get_installed_package_state, invalidate_installed_cache};
use crate::commands::package_mutation::{
    PackageMutationFinishedEvent, EVENT_PACKAGE_MUTATION_FINISHED,
};
use crate::commands::powershell::{CommandResult, FinalStatus};
use crate::commands::scoop::{self, generate_operation_id, ScoopOp};
use crate::state::AppState;
use tauri::{AppHandle, Emitter, State, Window};

/// Updates a specific Scoop package.
#[tauri::command]
pub async fn update_package(
    window: Window,
    app: AppHandle,
    state: State<'_, AppState>,
    package_name: String,
    force: Option<bool>,
    operation_id: Option<String>,
    bypass_self_update: Option<bool>,
) -> Result<(), String> {
    log::info!("Updating package '{}'", package_name);
    let event_window = window.clone();

    let op = if force.unwrap_or(false) {
        ScoopOp::UpdateForce
    } else {
        ScoopOp::Update
    };

    let operation_id =
        operation_id.unwrap_or_else(|| generate_operation_id(ScoopOp::Update, Some(&package_name)));

    let update_result = scoop::execute_scoop(
        window,
        op,
        Some(&package_name),
        None,
        operation_id.clone(),
        bypass_self_update.unwrap_or(false),
    )
    .await;

    match &update_result {
        Ok(_) => {
            log::info!("Package '{}' updated successfully", package_name);
        }
        Err(e) => {
            log::error!("Package '{}' update failed: {}", package_name, e);
        }
    }

    update_result?;
    invalidate_installed_cache(state.clone()).await;
    let scoop_path = state.scoop_path();
    let package_state = match get_installed_package_state(&scoop_path, &package_name) {
        Ok(package_state) => package_state,
        Err(error) => {
            log::warn!(
                "Failed to resolve final package state for '{}': {}",
                package_name,
                error
            );
            None
        }
    };

    let _ = event_window.emit(
        EVENT_PACKAGE_MUTATION_FINISHED,
        PackageMutationFinishedEvent {
            result: CommandResult {
                success: true,
                operation_id: operation_id.clone(),
                operation_name: match op {
                    ScoopOp::UpdateForce => format!("Force updating {}", package_name),
                    _ => format!("Updating {}", package_name),
                },
                error_count: None,
                warning_count: None,
                final_status: FinalStatus::Success,
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64,
            },
            package_name: package_name.clone(),
            package_source: package_state.as_ref().map(|pkg| pkg.source.clone()),
            package_state,
        },
    );

    trigger_auto_cleanup(app, state).await;

    Ok(())
}

/// Updates all Scoop packages.
#[tauri::command]
pub async fn update_all_packages(
    window: Window,
    app: AppHandle,
    state: State<'_, AppState>,
    operation_id: Option<String>,
) -> Result<(), String> {
    log::info!("Updating all packages (manual)");

    // Use the provided operation_id or generate a new one
    let operation_id =
        operation_id.unwrap_or_else(|| generate_operation_id(ScoopOp::UpdateAll, None));

    // Execute the update through window streaming
    let result = scoop::execute_scoop(
        window.clone(),
        ScoopOp::UpdateAll,
        None,
        None,
        operation_id,
        false,
    )
    .await;

    // Return the original result (success or error)
    result?;

    // Trigger auto cleanup after update all
    trigger_auto_cleanup(app, state).await;

    Ok(())
}

/// Headless variant used by background scheduler (no UI streaming). Returns update details.
pub async fn update_all_packages_headless(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    use crate::commands::doctor::notify_icon_settings::{
        discard_tray_config_migration, finalize_tray_config_migration,
        prepare_tray_config_migration, TrayMigrationFinalizeArgs, TrayMigrationPrepareArgs,
    };
    use crate::commands::powershell;
    use crate::commands::settings;
    use tokio::io::AsyncReadExt;

    log::info!("(Headless) Updating all packages");
    let tray_migration_op_id = format!(
        "headless-update-all-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0)
    );
    let tray_auto_enabled = settings::get_config_value(
        app.clone(),
        "automation.autoTrayConfigMigration".to_string(),
    )
    .ok()
    .flatten()
    .and_then(|v| v.as_bool())
    .unwrap_or(false);
    let preserve_versioned = settings::get_config_value(
        app.clone(),
        "automation.preserveTrayEntriesForVersionedInstalls".to_string(),
    )
    .ok()
    .flatten()
    .and_then(|v| v.as_bool())
    .unwrap_or(true);

    if tray_auto_enabled {
        let prepare_args = TrayMigrationPrepareArgs {
            operation_id: tray_migration_op_id.clone(),
            operation_type: "update-all-headless".to_string(),
            package_name: None,
            preserve_versioned_installs: Some(preserve_versioned),
        };
        if let Err(e) = prepare_tray_config_migration(state.clone(), prepare_args).await {
            log::warn!(
                "[tray-migration][headless] prepare failed (op={}): {}",
                tray_migration_op_id,
                e
            );
        }
    }

    let update_all_command = powershell::build_scoop_update_all_skip_self_update_command();
    let mut cmd = powershell::create_powershell_command(&update_all_command);
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn scoop update *: {}", e))?;

    let stdout_task = {
        let mut out = child.stdout.take();
        tokio::spawn(async move {
            let mut buf = Vec::new();
            if let Some(mut stream) = out.take() {
                stream
                    .read_to_end(&mut buf)
                    .await
                    .map_err(|e| format!("Failed to read stdout: {}", e))?;
            }
            Ok::<String, String>(String::from_utf8_lossy(&buf).to_string())
        })
    };

    let stderr_task = {
        let mut err = child.stderr.take();
        tokio::spawn(async move {
            let mut buf = Vec::new();
            if let Some(mut stream) = err.take() {
                stream
                    .read_to_end(&mut buf)
                    .await
                    .map_err(|e| format!("Failed to read stderr: {}", e))?;
            }
            Ok::<String, String>(String::from_utf8_lossy(&buf).to_string())
        })
    };

    let status = child
        .wait()
        .await
        .map_err(|e| format!("Failed to execute scoop update *: {}", e))?;
    let stdout = stdout_task
        .await
        .map_err(|e| format!("Failed to join stdout task: {}", e))??;
    let stderr = stderr_task
        .await
        .map_err(|e| format!("Failed to join stderr task: {}", e))??;

    if !status.success() {
        log::warn!(
            "Headless update_all_packages exited with status: {}",
            status
        );
        if !stdout.is_empty() {
            log::debug!(
                "Partial stdout: {}",
                stdout.lines().take(20).collect::<Vec<_>>().join(" | ")
            );
        }

        if !stderr.is_empty() {
            log::debug!("Headless update stderr: {}", stderr);
        }

        // Return error details from stderr or stdout
        let error_lines: Vec<String> = stderr
            .lines()
            .chain(stdout.lines())
            .filter(|line| !line.trim().is_empty())
            .take(10)
            .map(|line| line.to_string())
            .collect();

        let err = format!("Headless package update failed: {}", error_lines.join("; "));
        if tray_auto_enabled {
            let _ = discard_tray_config_migration(TrayMigrationFinalizeArgs {
                operation_id: tray_migration_op_id.clone(),
            })
            .await
            .map_err(|e| {
                log::warn!(
                    "[tray-migration][headless] discard failed (op={}): {}",
                    tray_migration_op_id,
                    e
                );
                e
            });
        }
        return Err(err);
    }

    // Parse output to extract update details
    let update_lines: Vec<String> = stdout
        .lines()
        .filter(|line| {
            let trimmed = line.trim();
            !trimmed.is_empty()
                && (trimmed.contains("Updating")
                    || trimmed.contains("Updated")
                    || trimmed.contains("up to date")
                    || trimmed.contains("Installing")
                    || trimmed.contains("Downloading")
                    || trimmed.contains("Extracting")
                    || trimmed.contains("Linking")
                    || trimmed.contains("WARN")
                    || trimmed.contains("ERROR"))
        })
        .map(|line| line.trim().to_string())
        .collect();

    // Log the update details
    for line in &update_lines {
        log::info!("{}", line);
    }

    // If no meaningful output, add a summary
    let result = if update_lines.is_empty() {
        vec!["All packages are up to date.".to_string()]
    } else {
        update_lines
    };

    if tray_auto_enabled {
        let _ = finalize_tray_config_migration(
            state.clone(),
            TrayMigrationFinalizeArgs {
                operation_id: tray_migration_op_id.clone(),
            },
        )
        .await
        .map_err(|e| {
            log::warn!(
                "[tray-migration][headless] finalize failed (op={}): {}",
                tray_migration_op_id,
                e
            );
            e
        });
    }

    // Trigger auto cleanup after successful headless update
    trigger_auto_cleanup(app, state).await;
    log::info!("Headless package update completed successfully");
    Ok(result)
}
