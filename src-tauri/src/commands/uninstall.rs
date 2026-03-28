//! Commands for uninstalling packages and clearing the cache.
use crate::commands::auto_cleanup::trigger_auto_cleanup;
use crate::commands::installed::invalidate_installed_cache;
use crate::commands::scoop::{self, ScoopOp, generate_operation_id};
use crate::commands::search::invalidate_manifest_cache;
use crate::state::AppState;
use tauri::{AppHandle, State, Window};

/// Uninstalls a Scoop package.
///
/// Note: The `bucket` parameter is not used by the underlying `scoop uninstall` command
/// but is included for API consistency and logging purposes.
///
/// # Arguments
/// * `window` - The Tauri window to emit events to.
/// * `app` - The Tauri app handle.
/// * `state` - The application state.
/// * `package_name` - The name of package to uninstall.
/// * `bucket` - The bucket package belongs to (for logging purposes).
/// * `operation_id` - Optional operation ID for tracking.
#[tauri::command]
pub async fn uninstall_package(
    window: Window,
    app: AppHandle,
    state: State<'_, AppState>,
    package_name: String,
    bucket: String,
    operation_id: Option<String>,
) -> Result<(), String> {
    execute_package_operation(
        window.clone(),
        ScoopOp::Uninstall,
        &package_name,
        Some(&bucket),
        operation_id,
    )
    .await?;
    invalidate_manifest_cache().await;
    invalidate_installed_cache(state.clone()).await;

    // Trigger auto cleanup after uninstall
    trigger_auto_cleanup(app, state).await;

    Ok(())
}

/// Clears the cache for a Scoop package.
///
/// Note: The `bucket` parameter is not used by the underlying `scoop cache rm` command
/// but is included for API consistency and logging purposes.
///
/// # Arguments
/// * `window` - The Tauri window to emit events to.
/// * `app` - The Tauri app handle.
/// * `state` - The application state.
/// * `package_name` - The name of the package to clear the cache for.
/// * `bucket` - The bucket the package belongs to (for logging purposes).
/// * `operation_id` - Optional operation ID for tracking.
#[tauri::command]
pub async fn clear_package_cache(
    window: Window,
    app: AppHandle,
    state: State<'_, AppState>,
    package_name: String,
    bucket: String,
    operation_id: Option<String>,
) -> Result<(), String> {
    execute_package_operation(
        window,
        ScoopOp::ClearCache,
        &package_name,
        Some(&bucket),
        operation_id,
    )
    .await?;

    // Trigger auto cleanup after clearing cache
    trigger_auto_cleanup(app, state).await;

    Ok(())
}

/// A helper function to execute a Scoop operation on a package.
///
/// This function handles the common logic for parsing the bucket, logging the operation,
/// and calling the underlying `execute_scoop` function.
async fn execute_package_operation(
    window: Window,
    op: ScoopOp,
    package: &str,
    bucket: Option<&str>,
    operation_id: Option<String>,
) -> Result<(), String> {
    log::info!(
        "Executing {} for package '{}' from bucket '{}'",
        match op {
            ScoopOp::Install => "installing",
            ScoopOp::Uninstall => "uninstalling",
            ScoopOp::Update => "updating",
            ScoopOp::UpdateForce => "force updating",
            ScoopOp::ClearCache => "clearing cache for",
            ScoopOp::UpdateAll => "updating all",
        },
        package,
        bucket.unwrap_or("default")
    );

    // Use the provided operation_id or generate a new one
    let operation_id = operation_id.unwrap_or_else(|| {
        generate_operation_id(op, Some(package))
    });

    // Pass the bucket option along; `execute_scoop` will handle whether it's used.
    scoop::execute_scoop(window, op, Some(package), bucket, operation_id, false).await
}
