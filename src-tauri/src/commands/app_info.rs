use crate::utils;
use tauri;

/// Checks if the application is installed via Scoop package manager
#[tauri::command]
pub fn is_scoop_installation() -> bool {
    utils::is_scoop_installation()
}
