use tauri::{command, AppHandle};

/// Test command to verify the current update configuration
#[command]
pub async fn test_update_config(_app_handle: AppHandle) -> Result<String, String> {
    let current_dir = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?;
    
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?;
    
    let scoop_installed = crate::utils::is_scoop_installation();
    
    let result = format!(
        "Update Configuration Test Results:\n\
        - Current Directory: {}\n\
        - Executable Path: {}\n\
        - Scoop Installation: {}\n\
        - Platform: {}",
        current_dir.display(),
        exe_path.display(),
        scoop_installed,
        std::env::consts::OS
    );
    
    Ok(result)
}

/// Get the current update channel from settings
#[command]
pub async fn get_current_update_channel(app_handle: AppHandle) -> Result<String, String> {
    match crate::commands::update_config::get_update_channel(app_handle).await {
        Ok(channel) => Ok(format!("Current update channel: {}", channel)),
        Err(e) => Err(format!("Failed to get current update channel: {}", e)),
    }
}