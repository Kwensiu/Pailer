use crate::utils;
use std::process::Command;
use tauri::{AppHandle, Runtime};
use tokio::time::{sleep, Duration};

/// Updates Pailer via Scoop after closing the current process.
/// This command is only used when Pailer itself is installed by Scoop.
#[tauri::command]
pub async fn update_pailer_self<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
    let current_pid = std::process::id();
    log::info!("Starting Pailer self-update process (PID: {})", current_pid);

    // Verify this is a Scoop installation
    if !utils::is_scoop_installation() {
        log::warn!(
            "Self-update rejected: not a Scoop installation (PID: {})",
            current_pid
        );
        return Err("Pailer is not installed via Scoop. Self-update is only available for Scoop installations.".to_string());
    }

    // Load the detached updater batch script with PID injection.
    let script_template = include_str!("../../scripts/self_update.cmd");
    let update_script = script_template.replace("{PID}", &current_pid.to_string());

    log::info!("Preparing self-update script (PID: {})", current_pid);

    // Create a temporary updater script file
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let script_path = std::env::temp_dir().join(format!(
        "pailer_self_update_{}_{}.cmd",
        std::process::id(),
        timestamp
    ));

    if let Err(e) = std::fs::write(&script_path, update_script) {
        return Err(format!("Failed to write updater script: {}", e));
    }

    log::info!("Self-update script written to: {}", script_path.display());

    // Best effort cleanup of old temporary updater scripts to avoid buildup.
    if let Ok(entries) = std::fs::read_dir(std::env::temp_dir()) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                if file_name.starts_with("pailer_self_update_")
                    && file_name.ends_with(".cmd")
                    && path != script_path
                {
                    let _ = std::fs::remove_file(path);
                }
            }
        }
    }

    // Run updater from %TEMP% to avoid locking the Scoop install directory.
    log::info!("Starting self-update process");
    let mut command = Command::new("cmd");
    command
        .arg("/K")
        .arg(script_path.to_string_lossy().to_string())
        .current_dir(std::env::temp_dir());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NEW_PROCESS_GROUP | CREATE_NEW_CONSOLE
        command.creation_flags(0x0000_0200 | 0x0000_0010);
    }

    command
        .spawn()
        .map_err(|e| format!("Failed to spawn self-update process: {}", e))?;

    log::info!("Self-update process started successfully");

    // Exit the main app after the invoke response has a brief chance to flush to the frontend.
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        sleep(Duration::from_millis(300)).await;
        app_handle.exit(0);
    });

    Ok("Pailer self-update started in background. Pailer will now close so the updater can continue.".to_string())
}

/// Check if Pailer can be self-updated (i.e., installed via Scoop)
#[tauri::command]
pub fn can_self_update() -> bool {
    utils::is_scoop_installation()
}
