use crate::utils;
use std::process::Command;
use tauri::{AppHandle, Runtime};
use tokio::time::{sleep, Duration};

/// Updates Pailer itself using scoop after closing the current process
/// This command is specifically designed for self-updating when Pailer is installed via Scoop
#[tauri::command]
pub async fn update_pailer_self<R: Runtime>(
    _app: AppHandle<R>,
) -> Result<String, String> {
    let current_pid = std::process::id();
    log::info!("Starting Pailer self-update process (PID: {})", current_pid);
    
    // Verify this is a Scoop installation
    if !utils::is_scoop_installation() {
        log::warn!("Self-update rejected: not a Scoop installation (PID: {})", current_pid);
        return Err("Pailer is not installed via Scoop. Self-update is only available for Scoop installations.".to_string());
    }

    // Load PowerShell script from external file with template replacement
    let script_template = include_str!("../../scripts/self_update.ps1");
    let powershell_script = script_template.replace("{PID}", &current_pid.to_string());

    log::info!("Executing PowerShell self-update script (PID: {})", current_pid);
    
    // Create a temporary PowerShell script file with improved error handling
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let script_path = std::env::temp_dir().join(format!("pailer_self_update_{}_{}.ps1", std::process::id(), timestamp));
    
    // Write script with immediate cleanup on failure
    if let Err(e) = std::fs::write(&script_path, powershell_script) {
        return Err(format!("Failed to write PowerShell script: {}", e));
    }
    
    log::info!("PowerShell script written to: {}", script_path.display());

    // RAII guard to ensure cleanup even on panic or early return
    struct TempScriptGuard(std::path::PathBuf);
    impl Drop for TempScriptGuard {
        fn drop(&mut self) {
            if let Err(e) = std::fs::remove_file(&self.0) {
                log::warn!("Failed to clean up temporary script file: {}", e);
            } else {
                log::info!("Temporary script file cleaned up successfully");
            }
        }
    }
    let _guard = TempScriptGuard(script_path.clone());

    // Execute PowerShell script with visible window and real-time output
    log::info!("Starting PowerShell self-update script with visible window");
    
    // Create a new process with visible window for real-time feedback
    let mut child = Command::new("powershell")
        .args(&[
            "-WindowStyle", "Normal",  // Show window normally
            "-ExecutionPolicy", "Bypass",
            "-File", &script_path.to_string_lossy()
        ])
        .spawn()
        .map_err(|e| format!("Failed to spawn PowerShell process: {}", e))?;

    log::info!("PowerShell process started with PID: {:?}", child.id());

    // Wait for the process to complete with timeout
    let timeout_duration = Duration::from_secs(360); // 6 minutes timeout (longer than script's 5 minutes)
    let start_time = std::time::Instant::now();
    
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                // Process has completed
                log::info!("PowerShell process completed with status: {}", status);
                // Cleanup handled by RAII guard
                
                if !status.success() {
                    let code = status.code().unwrap_or(-1);
                    log::error!("PowerShell script failed with exit code: {}", code);
                    return Err(format!("PowerShell script failed with exit code: {}", code));
                }
                
                return Ok("Pailer self-update initiated successfully. The application will close and restart automatically.".to_string());
            }
            Ok(None) => {
                // Process is still running
                if start_time.elapsed() > timeout_duration {
                    log::error!("PowerShell process timed out after {:?}", timeout_duration);
                    // Cleanup handled by RAII guard
                    
                    // Try to kill the process and wait for it to exit
                    if let Err(e) = child.kill() {
                        log::error!("Failed to kill PowerShell process: {}", e);
                    } else {
                        // Wait a moment for the process to actually exit
                        match child.wait() {
                            Ok(status) => {
                                log::info!("PowerShell process killed with status: {}", status);
                            }
                            Err(e) => {
                                log::error!("Error waiting for killed PowerShell process: {}", e);
                            }
                        }
                    }
                    
                    return Err("PowerShell script timed out".to_string());
                }
                
                // Use async sleep instead of blocking the thread
                sleep(Duration::from_secs(1)).await;
            }
            Err(e) => {
                // Cleanup handled by RAII guard
                return Err(format!("Error while waiting for PowerShell process: {}", e));
            }
        }
    }
}

/// Check if Pailer can be self-updated (i.e., installed via Scoop)
#[tauri::command]
pub fn can_self_update() -> bool {
    utils::is_scoop_installation()
}
