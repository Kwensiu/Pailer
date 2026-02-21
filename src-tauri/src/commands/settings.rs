//! Commands for reading and writing application settings from the persistent store.
use serde_json::{Map, Value};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Runtime, Manager};
use tauri_plugin_store::{Store, StoreExt};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use aes_gcm::aead::{Aead, KeyInit};
use rand::random;
use base64::{Engine as _, engine::general_purpose};

/// Current store file name for unified settings (frontend + backend)
const STORE_PATH: &str = "settings.json";
/// Legacy store file name (for migration)
const LEGACY_STORE_PATH: &str = "core.json";

/// Fixed application-level encryption key (32 bytes for AES-256)
// This is a simple approach following KISS principle - in production, consider using system keychain
const ENCRYPTION_KEY: &[u8; 32] = b"ScoopMetaSecureKeyForAPIStor2024";

fn encrypt_api_key(key: &str) -> Result<String, String> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(ENCRYPTION_KEY));
    let nonce_bytes: [u8; 12] = random(); // 96-bit nonce
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher.encrypt(nonce, key.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;

    // Concatenate nonce and ciphertext, then encode
    let mut combined = nonce_bytes.to_vec();
    combined.extend(ciphertext);
    Ok(general_purpose::STANDARD.encode(&combined))
}

fn decrypt_api_key(encrypted_key: &str) -> Result<String, String> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(ENCRYPTION_KEY));

    let combined = general_purpose::STANDARD.decode(encrypted_key)
        .map_err(|e| format!("Base64 decode failed: {}", e))?;

    if combined.len() < 12 {
        return Err("Invalid encrypted data: too short".to_string());
    }

    let nonce_bytes = &combined[..12];
    let nonce = Nonce::from_slice(nonce_bytes);
    let ciphertext = &combined[12..];

    let plaintext = cipher.decrypt(nonce, ciphertext.as_ref())
        .map_err(|e| format!("Decryption failed: {}", e))?;

    String::from_utf8(plaintext)
        .map_err(|e| format!("UTF-8 decode failed: {}", e))
}

/// Migrates data from legacy store.json to core.json if needed.
/// Returns true if migration was performed.
fn migrate_from_legacy_store<R: Runtime>(app: &AppHandle<R>) -> bool {
    let app_data_dir = match app.path().app_data_dir() {
        Ok(dir) => dir,
        Err(_) => return false,
    };

    let legacy_path = app_data_dir.join(LEGACY_STORE_PATH);
    let new_path = app_data_dir.join(STORE_PATH);

    // Skip if new store already exists or legacy doesn't exist
    if new_path.exists() || !legacy_path.exists() {
        return false;
    }

    log::info!("Migrating store from {} to {}", LEGACY_STORE_PATH, STORE_PATH);

    // Read legacy store content
    if let Ok(content) = fs::read_to_string(&legacy_path) {
        // Write to new location
        if fs::write(&new_path, &content).is_ok() {
            // Optionally remove legacy file after successful migration
            // Keep it for now as a backup
            log::info!("Successfully migrated {} to {}", LEGACY_STORE_PATH, STORE_PATH);
            return true;
        }
    }

    false
}

/// A helper function to reduce boilerplate when performing a write operation on the store.
///
/// It loads the store, applies the given operation, and saves the changes to disk.
fn with_store_mut<R: Runtime, F, T>(app: AppHandle<R>, operation: F) -> Result<T, String>
where
    F: FnOnce(&Store<R>) -> T,
{
    // Attempt migration from legacy store if needed
    migrate_from_legacy_store(&app);
    
    let store = app
        .store(PathBuf::from(STORE_PATH))
        .map_err(|e| e.to_string())?;
    let result = operation(&store);
    store.save().map_err(|e| e.to_string())?;
    Ok(result)
}

/// A helper function to reduce boilerplate when performing a read operation on the store.
fn with_store_get<R: Runtime, F, T>(app: AppHandle<R>, operation: F) -> Result<T, String>
where
    F: FnOnce(&Store<R>) -> T,
{
    // Attempt migration from legacy store if needed
    migrate_from_legacy_store(&app);
    
    let store = app
        .store(PathBuf::from(STORE_PATH))
        .map_err(|e| e.to_string())?;
    Ok(operation(&store))
}

/// Returns the path to the Scoop configuration file.
///
/// Scoop uses: `~/.config/scoop/config.json` where ~ is %USERPROFILE%
fn get_scoop_config_path() -> Result<PathBuf, String> {
    std::env::var("USERPROFILE")
        .map_err(|_| "Could not get USERPROFILE environment variable".to_string())
        .map(|profile| PathBuf::from(profile).join(".config").join("scoop").join("config.json"))
}

/// Reads the Scoop configuration file and returns its contents as a JSON map.
///
/// If the file doesn't exist, it returns an empty map.
fn read_scoop_config() -> Result<Map<String, Value>, String> {
    let path = get_scoop_config_path()?;
    if !path.exists() {
        return Ok(Map::new());
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read Scoop config at {:?}: {}", path, e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse Scoop config at {:?}: {}", path, e))
}

/// Writes the given JSON map to the Scoop configuration file.
///
/// This will create the directory and file if they don't exist.
fn write_scoop_config(config: &Map<String, Value>) -> Result<(), String> {
    let path = get_scoop_config_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create Scoop config directory: {}", e))?;
    }
    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize Scoop config: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("Failed to write to {:?}: {}", path, e))
}

/// Gets the configured Scoop path from the store.
#[tauri::command]
pub fn get_scoop_path<R: Runtime>(app: AppHandle<R>) -> Result<Option<String>, String> {
    with_store_get(app, |store| {
        // Try to get from settings.scoopPath first (new unified format)
        if let Some(settings) = store.get("settings") {
            if let Some(scoop_path) = settings.get("scoopPath") {
                return scoop_path.as_str().map(String::from);
            }
        }
        
        // Fallback to legacy format (direct scoop_path)
        store
            .get("scoop_path")
            .and_then(|v| v.as_str().map(String::from))
    })
}

/// Sets the Scoop path in the store.
#[tauri::command]
pub fn set_scoop_path<R: Runtime>(app: AppHandle<R>, path: String) -> Result<(), String> {
    let path_clone = path.clone();
    with_store_mut(app.clone(), move |store| {
        // Try to update in settings.scoopPath (new unified format)
        if let Some(settings) = store.get("settings") {
            let mut settings_obj = settings.as_object().unwrap_or(&mut serde_json::Map::new()).clone();
            settings_obj.insert("scoopPath".to_string(), serde_json::json!(path_clone));
            store.set("settings", serde_json::Value::Object(settings_obj));
            return;
        }
        
        // Fallback to legacy format (direct scoop_path)
        store.set("scoop_path", serde_json::json!(path_clone));
    })?;
    
    // Also update the in-memory app state if it exists
    // We're only setting the scoop path synchronously and not clearing the cache
    // to avoid needing async context or blocking operations
    if let Some(state) = app.try_state::<crate::state::AppState>() {
        state.set_scoop_path(std::path::PathBuf::from(path));
    }
    
    Ok(())
}

/// Validates if a path is a valid Scoop installation directory
/// by checking for required subdirectories
/// Fix: Ensure this command is registered in lib.rs
#[tauri::command]
pub fn validate_scoop_directory(path: String) -> Result<bool, String> {
    use std::path::Path;
    
    let path = Path::new(&path);
    
    // Check if path exists and is a directory
    if !path.exists() {
        return Ok(false);
    }
    
    if !path.is_dir() {
        return Ok(false);
    }
    
    // Check for required Scoop directories
    let apps_dir = path.join("apps");
    let buckets_dir = path.join("buckets");
    let cache_dir = path.join("cache");
    
    if !apps_dir.exists() || !buckets_dir.exists() || !cache_dir.exists() {
        return Ok(false);
    }
    
    if !apps_dir.is_dir() || !buckets_dir.is_dir() || !cache_dir.is_dir() {
        return Ok(false);
    }
    
    Ok(true)
}

/// Detects the Scoop path by checking environment variables and Scoop's own configuration
#[tauri::command]
pub fn detect_scoop_path() -> Result<String, String> {
    // Use the comprehensive detection logic from utils.rs
    let candidates = crate::utils::build_candidate_list(Vec::<PathBuf>::new());
    
    // Find the first valid candidate
    for candidate in candidates {
        if crate::utils::is_valid_scoop_candidate(&candidate) {
            log::info!("Detected Scoop path: {}", candidate.display());
            return Ok(candidate.to_string_lossy().to_string());
        }
    }

    Err("Could not detect Scoop installation directory. Please set the path manually.".to_string())
}



/// Gets a generic configuration value from the store by its key.
/// Supports dotted notation for accessing nested values (e.g., "cleanup.autoCleanupEnabled")
/// If the key contains dots, it will first try to access from the 'settings' object.
#[tauri::command]
pub fn get_config_value<R: Runtime>(
    app: AppHandle<R>,
    key: String,
) -> Result<Option<Value>, String> {
    with_store_get(app, |store| {
        // First try direct access
        if let Some(value) = store.get(&key) {
            return Some(value.clone());
        }

        // If key contains dots, try to access from nested 'settings' object
        if key.contains('.') {
            if let Some(settings_value) = store.get("settings") {
                if let Some(nested_value) = get_nested_value(&settings_value, &key) {
                    return Some(nested_value.clone());
                }
            }
        }

        None
    })
}

/// Helper function to get nested values using dot notation
fn get_nested_value<'a>(value: &'a Value, path: &str) -> Option<&'a Value> {
    let mut current = value;
    for key in path.split('.') {
        match current {
            Value::Object(obj) => {
                current = obj.get(key)?;
            }
            _ => return None,
        }
    }
    Some(current)
}

/// Sets a generic configuration value in the store.
#[tauri::command]
pub fn set_config_value(
    app: AppHandle<tauri::Wry>,
    key: String,
    value: Value,
) -> Result<(), String> {
    let key_clone = key.clone();
    with_store_mut(app.clone(), move |store| store.set(key_clone, value))?;

    // Trigger tray refresh for relevant settings
    match key.as_str() {
        "settings.language" | "tray.appsList" | "settings.window.trayAppsEnabled" => {
            let app_handle = app.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = crate::tray::refresh_tray_menu(&app_handle).await {
                    log::error!("Failed to refresh tray menu after setting change ({}): {}", key, e);
                }
            });
        }
        _ => {}
    }

    Ok(())
}

/// Gets the Scoop configuration as a JSON object
#[tauri::command]
pub fn get_scoop_config() -> Result<Option<serde_json::Map<String, serde_json::Value>>, String> {
    let path = get_scoop_config_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read Scoop config at {:?}: {}", path, e))?;
    let config: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse Scoop config at {:?}: {}", path, e))?;

    // Ensure it's an object and convert to Map
    match config {
        serde_json::Value::Object(map) => Ok(Some(map)),
        _ => Err(format!("Scoop config at {:?} is not a valid JSON object", path)),
    }
}

/// Updates the Scoop configuration with a new JSON object
#[tauri::command]
pub fn update_scoop_config(config: serde_json::Value) -> Result<(), String> {
    // Convert to Map for writing
    if let serde_json::Value::Object(map) = config {
        write_scoop_config(&map)
    } else {
        Err("Config must be a JSON object".to_string())
    }
}

/// Gets the VirusTotal API key from Scoop's `config.json`.
/// The key is stored encrypted for security.
#[tauri::command]
pub fn get_virustotal_api_key() -> Result<Option<String>, String> {
    let config = read_scoop_config()?;
    match config.get("virustotal_api_key").and_then(|v| v.as_str()) {
        Some(encrypted_key) => {
            // Try to decrypt the key
            match decrypt_api_key(encrypted_key) {
                Ok(decrypted_key) => Ok(Some(decrypted_key)),
                Err(e) => {
                    // If decryption fails, it might be a legacy unencrypted key
                    // Return as-is for backward compatibility
                    log::warn!("Failed to decrypt API key, treating as unencrypted: {}", e);
                    Ok(Some(encrypted_key.to_string()))
                }
            }
        }
        None => Ok(None),
    }
}

/// Sets the VirusTotal API key in Scoop's `config.json`.
/// The key is stored encrypted for security.
/// If the key is an empty string, it removes the `virustotal_api_key` field.
#[tauri::command]
pub fn set_virustotal_api_key(key: String) -> Result<(), String> {
    let mut config = read_scoop_config()?;
    if key.is_empty() {
        config.remove("virustotal_api_key");
    } else {
        // Encrypt the API key before storing
        let encrypted_key = encrypt_api_key(&key)?;
        config.insert("virustotal_api_key".to_string(), serde_json::json!(encrypted_key));
    }
    write_scoop_config(&config)
}

/// Gets the proxy setting from Scoop's `config.json`.
#[tauri::command]
pub fn get_scoop_proxy() -> Result<Option<String>, String> {
    let config = read_scoop_config()?;
    Ok(config
        .get("proxy")
        .and_then(|v| v.as_str().map(String::from)))
}

/// Sets the proxy setting in Scoop's `config.json`.
///
/// If the proxy is an empty string, it removes the `proxy` field.
#[tauri::command]
pub fn set_scoop_proxy(proxy: String) -> Result<(), String> {
    let mut config = read_scoop_config()?;
    if proxy.is_empty() {
        config.remove("proxy");
    } else {
        config.insert("proxy".to_string(), serde_json::json!(proxy));
    }
    write_scoop_config(&config)
}

/// Executes an arbitrary Scoop command
#[tauri::command]
pub async fn run_scoop_command(window: tauri::Window, command: String) -> Result<(), String> {
    let full_command = format!("scoop {}", command);
    crate::commands::powershell::run_and_stream_command(
        window,
        full_command,
        command.clone(),
        crate::commands::powershell::EVENT_OUTPUT,
        crate::commands::powershell::EVENT_FINISHED,
        crate::commands::powershell::EVENT_CANCEL,
        None,
    )
    .await
}

/// Gets the path to the Scoop configuration directory.
/// Returns the directory containing config.json, which is typically ~/.config/scoop/
#[tauri::command]
pub fn get_scoop_config_directory() -> Result<String, String> {
    let path = get_scoop_config_path()?;
    let dir_path = path.parent()
        .ok_or("Could not get parent directory of config file".to_string())?;
    Ok(dir_path.to_string_lossy().to_string())
}

/// Executes an arbitrary PowerShell command directly without adding any prefix
#[tauri::command]
pub async fn run_powershell_command(window: tauri::Window, command: String) -> Result<(), String> {
    crate::commands::powershell::run_and_stream_command(
        window,
        command.clone(),
        command.clone(),
        crate::commands::powershell::EVENT_OUTPUT,
        crate::commands::powershell::EVENT_FINISHED,
        crate::commands::powershell::EVENT_CANCEL,
        None,
    )
    .await
}

/// Sets the preferred PowerShell executable
#[tauri::command]
pub fn set_powershell_exe<R: Runtime>(_app: AppHandle<R>, exe: String) -> Result<(), String> {
    // Validate executable
    if !["auto", "pwsh", "powershell"].contains(&exe.as_str()) {
        return Err("Invalid PowerShell executable. Must be 'auto', 'pwsh', or 'powershell'.".to_string());
    }

    // Check availability for pwsh
    if exe == "pwsh" && !crate::commands::powershell::is_pwsh_available() {
        return Err("PowerShell Core (pwsh) is not available on this system.".to_string());
    }

    // Update the static variable
    match crate::commands::powershell::POWERSHELL_EXE.try_write() {
        Ok(mut guard) => *guard = exe.clone(),
        Err(_) => return Err("Failed to update PowerShell exe due to lock contention".to_string()),
    }

    Ok(())
}

/// Gets the available PowerShell executables
#[tauri::command]
pub fn get_available_powershell_executables() -> Result<Vec<String>, String> {
    let mut executables = vec!["auto".to_string()];

    if crate::commands::powershell::is_pwsh_available() {
        executables.push("pwsh".to_string());
    }

    if crate::commands::powershell::is_powershell_available() {
        executables.push("powershell".to_string());
    }

    Ok(executables)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_scoop_config_path() {
        // This test will only pass if USERPROFILE or HOME is set
        if let Ok(_) = get_scoop_config_path() {
            assert!(true);
        } else {
            // Skip test if environment variables are not set
            assert!(true);
        }
    }
}