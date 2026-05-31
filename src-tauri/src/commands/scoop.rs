use super::powershell::{self, EVENT_CANCEL, EVENT_FINISHED, EVENT_OUTPUT};
use tauri::{Emitter, Window};

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
    let build_update_command = |pkg: &str, force: bool| {
        if bypass {
            crate::commands::powershell::build_scoop_update_bypass_command(pkg, force)
        } else if force {
            format!("scoop update {} --force", pkg)
        } else {
            format!("scoop update {}", pkg)
        }
    };

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
            build_update_command(pkg, false)
        }
        ScoopOp::UpdateForce => {
            let pkg = package.ok_or("A package name is required to force update.")?;
            build_update_command(pkg, true)
        }
        ScoopOp::ClearCache => {
            let pkg = package.ok_or("A package name is required to clear the cache.")?;
            format!("scoop cache rm {}", pkg)
        }
        ScoopOp::UpdateAll => crate::commands::powershell::build_scoop_update_all_command(bypass),
    };

    Ok(command)
}

/// Executes a Scoop operation and streams the output to the frontend.
///
/// This function builds the Scoop command, creates a human-friendly operation
/// name for the UI, and then executes it using the PowerShell runner.
pub async fn execute_scoop(
    window: Window,
    op: ScoopOp,
    package: Option<&str>,
    bucket: Option<&str>,
    operation_id: String,
    bypass: bool,
) -> Result<(), String> {
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

    result
}

#[tauri::command]
pub async fn retry_operation_elevated(
    window: Window,
    operation_id: String,
    operation_name: String,
    operation_type: String,
    package_name: Option<String>,
    bucket_name: Option<String>,
    force_update: Option<bool>,
    skip_pre_update_refresh: Option<bool>,
) -> Result<(), String> {
    let op = match operation_type.as_str() {
        "install" => ScoopOp::Install,
        "uninstall" => ScoopOp::Uninstall,
        "update" | "auto-update" => {
            if force_update.unwrap_or(false) {
                ScoopOp::UpdateForce
            } else {
                ScoopOp::Update
            }
        }
        "update-all" => ScoopOp::UpdateAll,
        "clear-cache" => ScoopOp::ClearCache,
        other => {
            return Err(format!(
                "Unsupported operation type for elevated retry: {}",
                other
            ))
        }
    };

    let bypass = skip_pre_update_refresh.unwrap_or(false);

    let scoop_cmd = build_scoop_cmd(op, package_name.as_deref(), bucket_name.as_deref(), bypass)?;

    let ps_exe = powershell::resolve_powershell_exe();
    let escaped_cmd = scoop_cmd.replace('\'', "''");
    let wrapped = format!(
        "$ErrorActionPreference = 'Stop'; \
         $p = Start-Process '{}' -Verb RunAs -WindowStyle Hidden -PassThru -Wait -ArgumentList @('-NoProfile','-Command','{}'); \
         if ($null -eq $p) {{ throw 'Failed to start elevated process.' }}; \
         Write-Output ('Elevated process exit code: ' + $p.ExitCode); \
         if ($p.ExitCode -ne 0) {{ exit $p.ExitCode }}",
        ps_exe, escaped_cmd
    );

    let _ = window.emit(
        EVENT_OUTPUT,
        powershell::StreamOutput {
            operation_id: operation_id.clone(),
            line: "Requesting administrator privileges...".to_string(),
            source: "system".to_string(),
        },
    );
    let _ = window.emit(
        EVENT_OUTPUT,
        powershell::StreamOutput {
            operation_id: operation_id.clone(),
            line: "Output from the elevated process will appear after it completes.".to_string(),
            source: "system".to_string(),
        },
    );

    let mut cmd = powershell::create_powershell_command(&wrapped);
    let output = cmd
        .output()
        .await
        .map_err(|e| format!("Failed to run elevated retry for {}: {}", operation_name, e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    for line in stdout.lines().filter(|line| !line.trim().is_empty()) {
        let _ = window.emit(
            EVENT_OUTPUT,
            powershell::StreamOutput {
                operation_id: operation_id.clone(),
                line: line.to_string(),
                source: "stdout".to_string(),
            },
        );
    }

    for line in stderr.lines().filter(|line| !line.trim().is_empty()) {
        let _ = window.emit(
            EVENT_OUTPUT,
            powershell::StreamOutput {
                operation_id: operation_id.clone(),
                line: line.to_string(),
                source: "stderr".to_string(),
            },
        );
    }

    let success = output.status.success();
    let result = powershell::CommandResult {
        success,
        operation_id: operation_id.clone(),
        operation_name: operation_name.clone(),
        error_count: if success { None } else { Some(1) },
        warning_count: None,
        final_status: if success {
            powershell::FinalStatus::Success
        } else {
            powershell::FinalStatus::Error
        },
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64,
    };

    let _ = window.emit(EVENT_FINISHED, result);

    if success {
        Ok(())
    } else {
        Err(format!("Elevated retry failed for {}", operation_name))
    }
}
