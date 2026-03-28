//! Command for installing Scoop packages.
use crate::commands::auto_cleanup::trigger_auto_cleanup;
use crate::commands::installed::invalidate_installed_cache;
use crate::commands::scoop::{self, ScoopOp, generate_operation_id};
use crate::commands::search::invalidate_manifest_cache;
use crate::state::AppState;
use tauri::{AppHandle, State, Window};

/// Installs a Scoop package.
///
/// # Arguments
/// * `window` - The Tauri window to emit events to.
/// * `app` - The Tauri app handle.
/// * `state` - The application state.
/// * `package_name` - The name of package to install.
/// * `bucket` - The name of bucket to install from. If empty or "None", default buckets are used.
/// * `operation_id` - Optional operation ID for tracking.
#[tauri::command]
pub async fn install_package(
    window: Window,
    app: AppHandle,
    state: State<'_, AppState>,
    package_name: String,
    bucket: String,
    operation_id: Option<String>,
) -> Result<(), String> {
    let bucket_opt =
        (!bucket.is_empty() && !bucket.eq_ignore_ascii_case("none")).then(|| bucket.as_str());

    log::info!(
        "Installing package '{}' from bucket '{}'",
        package_name,
        bucket_opt.unwrap_or("default")
    );

    let operation_id = operation_id.unwrap_or_else(|| {
        generate_operation_id(ScoopOp::Install, Some(&package_name))
    });

    let install_result = scoop::execute_scoop(window, ScoopOp::Install, Some(&package_name), bucket_opt, operation_id.clone(), false).await;
    
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
    trigger_auto_cleanup(app, state).await;

    Ok(())
}