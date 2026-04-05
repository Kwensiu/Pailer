// Many thanks to Kwensiu for the original code on the forked repo: https://github.com/Kwensiu/Rscoop by AmarBego
//! Commands for managing application startup settings on Windows.

use std::env;
use std::path::{Path, PathBuf};
use tauri;
#[cfg(target_os = "windows")]
use winreg::{enums::*, RegKey};

const REG_KEY_PATH: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const REG_KEY_NAME: &str = "Pailer";
const SILENT_STARTUP_KEY: &str = "PailerSilentStartup";
const SCOOP_SHIM_RELATIVE_PATH: &str = "shims\\pailer.exe";

#[cfg(target_os = "windows")]
fn normalize_path(path: &str) -> String {
    path.trim_matches('"').replace('/', "\\").to_lowercase()
}

#[cfg(target_os = "windows")]
fn is_legacy_scoop_pailer_startup_entry(path: &str) -> bool {
    let normalized = normalize_path(path);
    normalized.contains("\\scoop\\apps\\pailer\\") && normalized.ends_with("\\pailer.exe")
}

#[cfg(target_os = "windows")]
fn find_scoop_root_from_current_exe(exe_path: &Path) -> Option<PathBuf> {
    let mut current = exe_path.parent();
    while let Some(dir) = current {
        if let Some(name) = dir.file_name().and_then(|v| v.to_str()) {
            if name.eq_ignore_ascii_case("apps") {
                return dir.parent().map(|p| p.to_path_buf());
            }
        }
        current = dir.parent();
    }
    None
}

#[cfg(target_os = "windows")]
fn resolve_scoop_shim_path() -> Result<PathBuf, String> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(scoop_env) = env::var("SCOOP") {
        candidates.push(PathBuf::from(scoop_env).join(SCOOP_SHIM_RELATIVE_PATH));
    }

    if let Ok(current_exe) = env::current_exe() {
        if let Some(root) = find_scoop_root_from_current_exe(&current_exe) {
            candidates.push(root.join(SCOOP_SHIM_RELATIVE_PATH));
        }
    }

    if let Ok(user_profile) = env::var("USERPROFILE") {
        candidates.push(
            PathBuf::from(user_profile)
                .join("scoop")
                .join(SCOOP_SHIM_RELATIVE_PATH),
        );
    }

    for candidate in candidates {
        if candidate.is_file() {
            return Ok(candidate);
        }
    }

    Err("Scoop shim not found at expected locations".to_string())
}

#[cfg(target_os = "windows")]
fn resolve_startup_command_path() -> Result<String, String> {
    let current_exe =
        env::current_exe().map_err(|e| format!("Failed to get current exe: {}", e))?;
    let current_exe_str = current_exe.to_string_lossy().to_string();

    if crate::utils::is_scoop_installation() {
        match resolve_scoop_shim_path() {
            Ok(shim_path) => {
                let shim = shim_path.to_string_lossy().to_string();
                log::info!("Using Scoop shim path for startup entry: {}", shim);
                Ok(shim)
            }
            Err(e) => {
                log::error!(
                    "Failed to resolve Scoop shim path for startup entry (fallback to current exe: {}): {}",
                    current_exe_str,
                    e
                );
                Ok(current_exe_str)
            }
        }
    } else {
        Ok(current_exe_str)
    }
}

/// Checks if the application is configured to start automatically on Windows boot.
#[tauri::command]
pub fn is_auto_start_enabled() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let startup_key = hkcu.open_subkey(REG_KEY_PATH).map_err(|e| e.to_string())?;

        // Check if our registry key exists
        match startup_key.get_value::<String, _>(REG_KEY_NAME) {
            Ok(current_value) => {
                let expected_startup_path = resolve_startup_command_path()?;
                let expected_path = Path::new(&expected_startup_path);

                // Parse registry value as path, remove quotes if present
                let registry_path_str = current_value.trim_matches('"');
                let registry_path = std::path::Path::new(registry_path_str);

                // Try to canonicalize registry path, if fails, compare directly as fallback
                let is_expected_match =
                    match (registry_path.canonicalize(), expected_path.canonicalize()) {
                        (Ok(registry_canonical), Ok(expected_canonical)) => {
                            registry_canonical == expected_canonical
                        }
                        _ => {
                            normalize_path(&current_value) == normalize_path(&expected_startup_path)
                        }
                    };

                if is_expected_match {
                    return Ok(true);
                }

                // Compatibility only: recognize legacy Scoop versioned path as enabled.
                // We intentionally do not auto-migrate here to keep the implementation simple.
                if crate::utils::is_scoop_installation()
                    && is_legacy_scoop_pailer_startup_entry(&current_value)
                {
                    log::warn!(
                        "Detected legacy Scoop auto-start entry path; treating as enabled without migration: {}",
                        current_value
                    );
                    return Ok(true);
                }

                Ok(false)
            }
            Err(_) => Ok(false),
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(false)
    }
}

/// Sets whether the application should start automatically on Windows boot.
#[tauri::command]
pub fn set_auto_start_enabled(enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let startup_key = hkcu
            .open_subkey_with_flags(REG_KEY_PATH, KEY_SET_VALUE)
            .map_err(|e| e.to_string())?;

        if enabled {
            // Enable auto-start by adding registry key
            let startup_target = resolve_startup_command_path()?;
            startup_key
                .set_value(REG_KEY_NAME, &startup_target)
                .map_err(|e| e.to_string())?;
            log::info!(
                "Set auto-start registry entry {} -> {}",
                REG_KEY_NAME,
                startup_target
            );
        } else {
            // Disable auto-start by removing both registry keys
            // Remove main auto-start entry
            match startup_key.delete_value(REG_KEY_NAME) {
                Ok(_) => log::info!("Removed auto-start registry entry: {}", REG_KEY_NAME),
                Err(e) => {
                    if e.kind() != std::io::ErrorKind::NotFound {
                        log::warn!(
                            "Failed to remove auto-start registry entry {}: {}",
                            REG_KEY_NAME,
                            e
                        );
                        return Err(e.to_string());
                    } else {
                        log::info!(
                            "Auto-start registry entry {} was not found (already removed)",
                            REG_KEY_NAME
                        );
                    }
                }
            }

            // Also remove silent startup entry for complete cleanup
            match startup_key.delete_value(SILENT_STARTUP_KEY) {
                Ok(_) => log::info!(
                    "Removed silent startup registry entry: {}",
                    SILENT_STARTUP_KEY
                ),
                Err(e) => {
                    if e.kind() != std::io::ErrorKind::NotFound {
                        log::warn!(
                            "Failed to remove silent startup registry entry {}: {}",
                            SILENT_STARTUP_KEY,
                            e
                        );
                    } else {
                        log::info!(
                            "Silent startup registry entry {} was not found (already removed)",
                            SILENT_STARTUP_KEY
                        );
                    }
                }
            }
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Auto-start is only supported on Windows".to_string())
    }
}

/// Cleans up all startup registry entries created by the application.
/// This should be called during uninstallation to ensure complete cleanup.
#[tauri::command]
pub fn cleanup_startup_entries() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let startup_key = hkcu
            .open_subkey_with_flags(REG_KEY_PATH, KEY_SET_VALUE)
            .map_err(|e| e.to_string())?;

        // Remove auto-start registry entry
        match startup_key.delete_value(REG_KEY_NAME) {
            Ok(_) => log::info!("Removed auto-start registry entry: {}", REG_KEY_NAME),
            Err(e) => {
                if e.kind() != std::io::ErrorKind::NotFound {
                    log::warn!(
                        "Failed to remove auto-start registry entry {}: {}",
                        REG_KEY_NAME,
                        e
                    );
                    return Err(e.to_string());
                } else {
                    log::info!(
                        "Auto-start registry entry {} was not found (already cleaned)",
                        REG_KEY_NAME
                    );
                }
            }
        }

        // Remove silent startup registry entry
        match startup_key.delete_value(SILENT_STARTUP_KEY) {
            Ok(_) => log::info!(
                "Removed silent startup registry entry: {}",
                SILENT_STARTUP_KEY
            ),
            Err(e) => {
                if e.kind() != std::io::ErrorKind::NotFound {
                    log::warn!(
                        "Failed to remove silent startup registry entry {}: {}",
                        SILENT_STARTUP_KEY,
                        e
                    );
                    return Err(e.to_string());
                } else {
                    log::info!(
                        "Silent startup registry entry {} was not found (already cleaned)",
                        SILENT_STARTUP_KEY
                    );
                }
            }
        }

        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        log::info!("Startup cleanup is not applicable on non-Windows platforms");
        Ok(())
    }
}

/// Checks if silent startup is enabled.
#[tauri::command]
pub fn is_silent_startup_enabled() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let startup_key = hkcu.open_subkey(REG_KEY_PATH).map_err(|e| e.to_string())?;

        match startup_key.get_value::<u32, _>(SILENT_STARTUP_KEY) {
            Ok(value) => Ok(value == 1),
            Err(_) => Ok(false),
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(false)
    }
}

/// Sets whether the application should start silently (minimized to tray).
#[tauri::command]
pub fn set_silent_startup_enabled(enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let startup_key = hkcu
            .open_subkey_with_flags(REG_KEY_PATH, KEY_SET_VALUE)
            .map_err(|e| e.to_string())?;

        if enabled {
            startup_key
                .set_value(SILENT_STARTUP_KEY, &1u32)
                .map_err(|e| e.to_string())?;
        } else {
            match startup_key.delete_value(SILENT_STARTUP_KEY) {
                Ok(_) => (),
                Err(e) => {
                    if e.kind() != std::io::ErrorKind::NotFound {
                        return Err(e.to_string());
                    }
                }
            }
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Silent startup is only supported on Windows".to_string())
    }
}
