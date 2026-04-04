use super::powershell::{self, EVENT_CANCEL, EVENT_FINISHED, EVENT_OUTPUT};
use lazy_static::lazy_static;
use tauri::Window;
use tokio::sync::Mutex;

lazy_static! {
    /// Serialises concurrent bypass updates to prevent LAST_UPDATE read-modify-restore races.
    static ref LAST_UPDATE_LOCK: Mutex<()> = Mutex::new(());
}

/// Defines the supported Scoop operations.
#[derive(Debug, Clone, Copy)]
pub enum ScoopOp {
    Install,
    Uninstall,
    Update,
    UpdateForce,
    ClearCache,
    UpdateAll,
}

/// Generate operation name based on operation type and package name
fn generate_operation_name(op: ScoopOp, package: Option<&str>) -> String {
    match (op, package) {
        (ScoopOp::Install, Some(pkg)) => format!("Installing {}", pkg),
        (ScoopOp::Uninstall, Some(pkg)) => format!("Uninstalling {}", pkg),
        (ScoopOp::Update, Some(pkg)) => format!("Updating {}", pkg),
        (ScoopOp::UpdateForce, Some(pkg)) => format!("Force updating {}", pkg),
        (ScoopOp::ClearCache, Some(pkg)) => format!("Clearing cache for {}", pkg),
        (ScoopOp::UpdateAll, _) => "Updating all packages".to_string(),
        // This case should not be reached if `build_scoop_cmd` is correct.
        _ => "Invalid operation or missing package name.".to_string(),
    }
}

/// Generate operation ID with timestamp
pub fn generate_operation_id(op: ScoopOp, package_name: Option<&str>) -> String {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    match (op, package_name) {
        (ScoopOp::Install, Some(pkg)) => format!("install-{}-{}", pkg, timestamp),
        (ScoopOp::Uninstall, Some(pkg)) => format!("uninstall-{}-{}", pkg, timestamp),
        (ScoopOp::Update, Some(pkg)) => format!("update-{}-{}", pkg, timestamp),
        (ScoopOp::UpdateForce, Some(pkg)) => format!("force-update-{}-{}", pkg, timestamp),
        (ScoopOp::ClearCache, Some(pkg)) => format!("clear-cache-{}-{}", pkg, timestamp),
        (ScoopOp::UpdateAll, None) => format!("update-all-{}", timestamp),
        _ => format!("unknown-{}", timestamp),
    }
}

/// Builds a Scoop command as a string, returning an error if a required
/// package name is missing.
fn build_scoop_cmd(
    op: ScoopOp,
    package: Option<&str>,
    bucket: Option<&str>,
    bypass: bool,
) -> Result<String, String> {
    let command = match op {
        ScoopOp::Install => {
            let pkg = package.ok_or("A package name is required to install.")?;
            match bucket {
                Some(b) => {
                    if bypass {
                        format!("scoop install {}/{} --no-update-scoop", b, pkg)
                    } else {
                        format!("scoop install {}/{}", b, pkg)
                    }
                }
                None => {
                    if bypass {
                        format!("scoop install {} --no-update-scoop", pkg)
                    } else {
                        format!("scoop install {}", pkg)
                    }
                }
            }
        }
        ScoopOp::Uninstall => {
            let pkg = package.ok_or("A package name is required to uninstall.")?;
            format!("scoop uninstall {}", pkg)
        }
        ScoopOp::Update => {
            let pkg = package.ok_or("A package name is required to update.")?;
            if bypass {
                format!("scoop config LAST_UPDATE ([System.DateTime]::Now.ToString('o')) | Out-Null; scoop update {}", pkg)
            } else {
                format!("scoop update {}", pkg)
            }
        }
        ScoopOp::UpdateForce => {
            let pkg = package.ok_or("A package name is required to force update.")?;
            if bypass {
                format!("scoop config LAST_UPDATE ([System.DateTime]::Now.ToString('o')) | Out-Null; scoop update {} --force", pkg)
            } else {
                format!("scoop update {} --force", pkg)
            }
        }
        ScoopOp::ClearCache => {
            let pkg = package.ok_or("A package name is required to clear the cache.")?;
            format!("scoop cache rm {}", pkg)
        }
        ScoopOp::UpdateAll => "function global:is_scoop_outdated { return $false }; Set-Item -Path Function:\\global:is_scoop_outdated -Options ReadOnly; scoop update *".to_string(),
    };

    Ok(command)
}

/// Executes a Scoop operation and streams the output to the frontend.
///
/// This function builds the Scoop command, creates a human-friendly operation
/// name for the UI, and then executes it using the PowerShell runner.
/// When bypass is true, holds LAST_UPDATE_LOCK for the full duration to prevent
/// concurrent-update races, backs up LAST_UPDATE, and restores (or removes) it
/// after — even on cancel.
pub async fn execute_scoop(
    window: Window,
    op: ScoopOp,
    package: Option<&str>,
    bucket: Option<&str>,
    operation_id: String,
    bypass: bool,
) -> Result<(), String> {
    // Serialise all bypass updates: hold the lock until backup + operation + restore finish.
    let _last_update_guard = if bypass {
        Some(LAST_UPDATE_LOCK.lock().await)
    } else {
        None
    };

    // Backup LAST_UPDATE before single-package bypass updates so we can restore it after.
    // `scoop config LAST_UPDATE` outputs "'LAST_UPDATE' is not set" (exit 0) when absent,
    // so we must filter that message rather than relying on an empty-string check.
    let last_update_backup = if bypass && matches!(op, ScoopOp::Update | ScoopOp::UpdateForce) {
        powershell::run_simple_command("scoop config LAST_UPDATE")
            .await
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty() && !s.contains("is not set"))
    } else {
        None
    };

    let cmd = build_scoop_cmd(op, package, bucket, bypass)?;
    let op_name = generate_operation_name(op, package);

    log::info!("[{}] Executing: {}", operation_id, cmd);

    let result = powershell::run_and_stream_command(
        window,
        cmd,
        op_name,
        EVENT_OUTPUT,
        EVENT_FINISHED,
        EVENT_CANCEL,
        operation_id.clone(),
    )
    .await;

    // Restore LAST_UPDATE — runs even when the operation was cancelled,
    // because run_and_stream_command always returns after killing the process.
    if bypass && matches!(op, ScoopOp::Update | ScoopOp::UpdateForce) {
        match last_update_backup {
            Some(ref backup) => {
                let escaped_backup = backup.replace('\'', "''");
                let restore_cmd =
                    format!("scoop config LAST_UPDATE '{}' | Out-Null", escaped_backup);
                if let Err(e) = powershell::run_simple_command(&restore_cmd).await {
                    log::error!("[{}] Failed to restore LAST_UPDATE: {}", operation_id, e);
                }
            }
            None => {
                // Key did not exist before bypass — remove it to leave no trace.
                if let Err(e) =
                    powershell::run_simple_command("scoop config rm LAST_UPDATE | Out-Null").await
                {
                    log::error!("[{}] Failed to remove LAST_UPDATE: {}", operation_id, e);
                }
            }
        }
    }

    result
}
