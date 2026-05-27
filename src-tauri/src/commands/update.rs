use crate::commands::auto_cleanup::trigger_auto_cleanup;
use crate::commands::installed::invalidate_installed_cache;
use crate::commands::package_mutation::{
    emit_installed_packages_changed, finalize_single_package_mutation, PackageMutationKind,
};
use crate::commands::scoop::{self, generate_operation_id, ScoopOp};
use crate::state::AppState;
use tauri::{AppHandle, State, Window};

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
    let mutation_kind = match op {
        ScoopOp::UpdateForce => PackageMutationKind::ForceUpdate,
        _ => PackageMutationKind::Update,
    };
    finalize_single_package_mutation(
        &event_window,
        state.clone(),
        mutation_kind,
        &package_name,
        None,
        operation_id.clone(),
    )
    .await;

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
        operation_id.clone(),
        false,
    )
    .await;

    // Return the original result (success or error)
    result?;

    invalidate_installed_cache(state.clone()).await;
    emit_installed_packages_changed(&window, "update-all", Some(operation_id));

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
    use crate::commands::scoop_update_runner;
    use crate::commands::settings;

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

    let update_result = match scoop_update_runner::run_update_all_headless().await {
        Ok(output) => output,
        Err(err) => {
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
    };

    // Log the update details
    let result = update_result.display_lines();
    for line in &result {
        log::info!("{}", line);
    }

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

    invalidate_installed_cache(state.clone()).await;
    emit_installed_packages_changed(&app, "update-all", None);

    // Trigger auto cleanup after successful headless update
    trigger_auto_cleanup(app, state).await;
    log::info!("Headless package update completed successfully");
    Ok(result)
}
