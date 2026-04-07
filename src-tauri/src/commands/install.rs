//! Command for installing Scoop packages.
use crate::commands::auto_cleanup::trigger_auto_cleanup;
use crate::commands::installed::{get_installed_package_state, invalidate_installed_cache};
use crate::commands::package_mutation::{
    PackageMutationFinishedEvent, EVENT_PACKAGE_MUTATION_FINISHED,
};
use crate::commands::powershell::{CommandResult, FinalStatus};
use crate::commands::scoop::{self, generate_operation_id, ScoopOp};
use crate::commands::search::invalidate_manifest_cache;
use crate::state::AppState;
use tauri::{AppHandle, Emitter, State, Window};

/// Installs a Scoop package.
///
/// # Arguments
/// * `window` - The Tauri window to emit events to.
/// * `app` - The Tauri app handle.
/// * `state` - The application state.
/// * `package_name` - The name of package to install.
/// * `bucket` - The name of bucket to install from. If empty or "None", default buckets are used.
/// * `operation_id` - Optional operation ID for tracking.
/// * `bypass_self_update` - Whether to bypass Scoop's self-update check.
#[tauri::command]
pub async fn install_package(
    window: Window,
    app: AppHandle,
    state: State<'_, AppState>,
    package_name: String,
    bucket: String,
    operation_id: Option<String>,
    bypass_self_update: Option<bool>,
) -> Result<(), String> {
    let event_window = window.clone();
    let bucket_opt =
        (!bucket.is_empty() && !bucket.eq_ignore_ascii_case("none")).then(|| bucket.as_str());

    log::info!(
        "Installing package '{}' from bucket '{}'",
        package_name,
        bucket_opt.unwrap_or("default")
    );

    let operation_id = operation_id
        .unwrap_or_else(|| generate_operation_id(ScoopOp::Install, Some(&package_name)));

    let install_result = scoop::execute_scoop(
        window,
        ScoopOp::Install,
        Some(&package_name),
        bucket_opt,
        operation_id.clone(),
        bypass_self_update.unwrap_or(false),
    )
    .await;

    match &install_result {
        Ok(_) => {
            log::info!("Package '{}' installed successfully", package_name);
        }
        Err(e) => {
            log::error!("Package '{}' installation failed: {}", package_name, e);
        }
    }

    install_result?;

    invalidate_manifest_cache().await;
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
                operation_name: format!("Installing {}", package_name),
                error_count: None,
                warning_count: None,
                final_status: FinalStatus::Success,
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64,
            },
            package_name: package_name.clone(),
            package_source: package_state
                .as_ref()
                .map(|pkg| pkg.source.clone())
                .or_else(|| bucket_opt.map(|bucket_name| bucket_name.to_string())),
            package_state,
        },
    );
    trigger_auto_cleanup(app, state).await;

    Ok(())
}
