//! Commands for retrieving diagnostic information about the application.
use crate::state::AppState;
use chrono::Local;
use std::fs;
use std::path::PathBuf;
use tauri::State;

// Constants for retry logic
const MAX_FILE_RETRIES: u32 = 3;
const FILE_RETRY_DELAY_MS: u64 = 100;

// Application identifiers
const TAURI_APP_ID: &str = "com.rscoop.app";
const OLD_APP_DIR: &str = "rscoop";

// Store data file names
const SETTINGS_FILE: &str = "settings.dat";
const SIGNALS_FILE: &str = "signals.dat";
const VERSION_FILE: &str = "version.txt";
const FACTORY_RESET_MARKER: &str = ".factory_reset";
const WEBVIEW_CLEANUP_MARKER: &str = ".cleanup_webview_on_startup";

// Backup file extension
const BACKUP_EXT: &str = ".bak";

// Locked files that should not be removed while app is running
const LOCKED_FILES: &[&str] = &[
    SETTINGS_FILE,
    SIGNALS_FILE,
    VERSION_FILE,
    FACTORY_RESET_MARKER,
];

// WebView locked directories
const WEBVIEW_LOCKED_DIRS: &[&str] = &[
    "shared_proto_db",
    "IndexedDB",
    "Local Storage",
    "Session Storage",
    "GPUCache",
    "Code Cache",
];

/// Gets the application data directory
#[tauri::command]
pub fn get_app_data_dir() -> Result<String, String> {
    // First try to get the Tauri app data directory
    if let Some(app_data_dir) = dirs::data_dir() {
        let app_data_dir = app_data_dir.join(TAURI_APP_ID);
        if app_data_dir.exists() {
            return Ok(app_data_dir.to_string_lossy().to_string());
        }
    }

    // Fallback to the old rscoop directory
    let data_dir = dirs::data_local_dir()
        .and_then(|d| Some(d.join(OLD_APP_DIR)))
        .ok_or("Could not determine data directory")?;

    Ok(data_dir.to_string_lossy().to_string())
}

/// Gets the log directory
#[tauri::command]
pub fn get_log_dir_cmd() -> Result<String, String> {
    let log_dir = get_log_dir().ok_or("Could not determine log directory")?;
    Ok(log_dir.to_string_lossy().to_string())
}

/// Gets the log retention days setting
#[tauri::command]
pub fn get_log_retention_days() -> Result<i32, String> {
    Ok(7)
}

/// Sets the log retention days setting
#[tauri::command]
pub fn set_log_retention_days(days: i32) -> Result<(), String> {
    log::info!("Setting log retention to {} days", days);
    Ok(())
}

/// Safely removes a file with retry logic
fn safe_remove_file(file_path: &std::path::Path) -> bool {
    // Skip WebView2 database files completely - they're heavily locked
    if is_webview_locked_file(file_path) {
        log::info!("Skipping WebView2 locked file: {}", file_path.display());
        return false;
    }

    for attempt in 1..=MAX_FILE_RETRIES {
        match fs::remove_file(file_path) {
            Ok(_) => {
                log::debug!("Successfully removed file: {}", file_path.display());
                return true;
            }
            Err(e) => {
                if attempt == MAX_FILE_RETRIES {
                    log::debug!(
                        "Failed to remove file after {} attempts: {} - {}",
                        MAX_FILE_RETRIES,
                        file_path.display(),
                        e
                    );
                    return false;
                }

                log::debug!(
                    "Attempt {} failed to remove file: {} - {}",
                    attempt,
                    file_path.display(),
                    e
                );

                // Wait before retrying
                std::thread::sleep(std::time::Duration::from_millis(FILE_RETRY_DELAY_MS));
            }
        }
    }
    false
}

/// Safely removes a directory with retry logic
fn safe_remove_dir(dir_path: &std::path::Path) -> bool {
    // Skip WebView2 database directories completely
    if is_webview_locked_dir(dir_path) {
        log::info!("Skipping WebView2 locked directory: {}", dir_path.display());
        return false;
    }

    const MAX_RETRIES: u32 = 3;
    const RETRY_DELAY_MS: u64 = 200;

    for attempt in 1..=MAX_RETRIES {
        match fs::remove_dir_all(dir_path) {
            Ok(_) => {
                log::debug!("Successfully removed directory: {}", dir_path.display());
                return true;
            }
            Err(e) => {
                if attempt == MAX_RETRIES {
                    log::debug!(
                        "Failed to remove directory after {} attempts: {} - {}",
                        MAX_RETRIES,
                        dir_path.display(),
                        e
                    );
                    return false;
                }

                log::debug!(
                    "Attempt {} failed to remove directory: {} - {}",
                    attempt,
                    dir_path.display(),
                    e
                );

                // Try to delete contents individually first
                if let Ok(entries) = fs::read_dir(dir_path) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.is_file() {
                            let _ = safe_remove_file(&path);
                        } else if path.is_dir() {
                            let _ = safe_remove_dir(&path);
                        }
                    }
                }

                std::thread::sleep(std::time::Duration::from_millis(RETRY_DELAY_MS));
            }
        }
    }
    false
}

/// Clears all application data and cache
#[tauri::command]
pub fn clear_application_data() -> Result<(), String> {
    log::info!("Starting application data cleanup");

    let mut total_cleared = 0;
    let mut failed_files = Vec::new();

    // Only clean directories that are safe - skip everything containing WebView
    // This completely avoids the locking issue
    let data_dirs = vec![
        // New Tauri app data directory (Roaming) - safe to clean
        dirs::data_dir().map(|d| d.join(TAURI_APP_ID)),
        // Old rscoop directory (Local) - safe to clean
        dirs::data_local_dir().map(|d| d.join(OLD_APP_DIR)),
    ];

    // Clean only the safe directories
    for data_dir_option in data_dirs {
        if let Some(data_dir) = data_dir_option {
            if data_dir.exists() && data_dir.is_dir() {
                log::info!("Clearing safe data directory: {}", data_dir.display());
                clear_regular_directory(&data_dir, &mut total_cleared, &mut failed_files)?;
            }
        }
    }

    // Clear Windows registry entries if on Windows
    #[cfg(windows)]
    clear_registry_data()?;

    log::info!(
        "Application data cleanup completed. Cleared {} files.",
        total_cleared
    );

    if !failed_files.is_empty() {
        log::info!(
            "Skipped {} items (contain WebView data or are locked):",
            failed_files.len()
        );
        // Only log at debug level to reduce noise
        for path in &failed_files {
            log::debug!("  - {}", path.display());
        }
    }

    Ok(())
}

/// Clear a regular directory safely
fn clear_regular_directory(
    data_dir: &std::path::Path,
    total_cleared: &mut usize,
    failed_files: &mut Vec<std::path::PathBuf>,
) -> Result<(), String> {
    // Get all entries first to avoid iterator issues
    let entries: Vec<std::path::PathBuf> = match fs::read_dir(data_dir) {
        Ok(entries) => entries.filter_map(Result::ok).map(|e| e.path()).collect(),
        Err(e) => {
            log::warn!("Failed to read directory {}: {}", data_dir.display(), e);
            return Ok(());
        }
    };

    for path in entries {
        if path.is_file() {
            // Skip files that are likely locked by the current process
            if is_file_locked_by_current_process(&path) {
                log::info!("Skipping locked file: {}", path.display());
                failed_files.push(path.clone());
                continue;
            }

            if safe_remove_file(&path) {
                *total_cleared += 1;
            } else {
                failed_files.push(path);
            }
        } else if path.is_dir() {
            if !safe_remove_dir(&path) {
                failed_files.push(path);
            }
        }
    }

    Ok(())
}

/// Check if a file is likely locked by the current process
fn is_file_locked_by_current_process(file_path: &std::path::Path) -> bool {
    let file_name = file_path.file_name().and_then(|n| n.to_str()).unwrap_or("");

    // Check if it's a known locked file
    if LOCKED_FILES.iter().any(|&locked| file_name == locked) {
        return true;
    }

    // Check if it's a log file that might be in use
    if file_name.ends_with(".log") || file_name.contains(OLD_APP_DIR) {
        return true;
    }

    false
}

/// Check if a file is a WebView2 locked database file
fn is_webview_locked_file(file_path: &std::path::Path) -> bool {
    let path_str = file_path.to_string_lossy();
    let file_name = file_path.file_name().and_then(|n| n.to_str()).unwrap_or("");

    // WebView2 database files that are heavily locked
    if path_str.contains("EBWebView")
        && (path_str.contains("shared_proto_db")
            || path_str.contains("IndexedDB")
            || path_str.contains("Local Storage")
            || path_str.contains("Session Storage"))
    {
        return true;
    }

    // Specific WebView2 database file patterns
    let webview_locked_patterns = ["LOCK", "LOG", "MANIFEST-", ".log"];

    if webview_locked_patterns
        .iter()
        .any(|&pattern| file_name.contains(pattern))
        && path_str.contains("EBWebView")
    {
        return true;
    }

    false
}

/// Check if a directory is a WebView2 locked database directory
fn is_webview_locked_dir(dir_path: &std::path::Path) -> bool {
    let path_str = dir_path.to_string_lossy();

    // WebView2 database directories that should not be touched
    path_str.contains("EBWebView")
        && WEBVIEW_LOCKED_DIRS
            .iter()
            .any(|pattern| path_str.contains(pattern))
}

/// Clears Windows registry entries related to the application
#[cfg(windows)]
fn clear_registry_data() -> Result<(), String> {
    log::info!("Attempting to clear Windows registry entries");

    use std::process::Command;
    use winreg::enums::*;
    use winreg::RegKey;

    let registry_keys = vec![
        r"HKEY_CURRENT_USER\Software\com.rscoop.app",
        r"HKEY_CURRENT_USER\Software\Rscoop",
        r"HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Uninstall\Rscoop",
        r"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Rscoop",
    ];

    for key in registry_keys {
        let output = Command::new("reg").args(&["delete", key, "/f"]).output();

        match output {
            Ok(result) => {
                if result.status.success() {
                    log::info!("Successfully deleted registry key: {}", key);
                } else {
                    log::debug!("Registry key not found or could not be deleted: {}", key);
                }
            }
            Err(e) => {
                log::debug!("Failed to execute registry command for {}: {}", key, e);
            }
        }

        let hklm_cu = RegKey::predef(HKEY_CURRENT_USER);

        let key_path = key.strip_prefix(r"HKEY_CURRENT_USER\").unwrap_or(key);
        let _ = hklm_cu.delete_subkey_all(key_path);

        let hklm_lm = RegKey::predef(HKEY_LOCAL_MACHINE);

        let key_path = key.strip_prefix(r"HKEY_LOCAL_MACHINE\").unwrap_or(key);
        let _ = hklm_lm.delete_subkey_all(key_path);
    }

    Ok(())
}

/// Checks if factory reset marker exists
#[tauri::command]
pub fn check_factory_reset_marker() -> Result<bool, String> {
    if let Some(app_data_dir) = dirs::data_dir() {
        let marker_file = app_data_dir.join(TAURI_APP_ID).join(FACTORY_RESET_MARKER);
        if marker_file.exists() {
            // Remove the marker after checking
            let _ = fs::remove_file(&marker_file);
            return Ok(true);
        }
    }
    Ok(false)
}

/// Creates a factory reset marker file
fn create_factory_reset_marker() -> Result<(), String> {
    log::info!("Creating factory reset marker");

    if let Some(app_data_dir) = dirs::data_dir() {
        let marker_file = app_data_dir.join(TAURI_APP_ID).join(FACTORY_RESET_MARKER);
        if let Some(parent) = marker_file.parent() {
            match fs::create_dir_all(parent) {
                Ok(_) => match fs::write(&marker_file, "Factory reset requested") {
                    Ok(_) => {
                        log::info!("Created factory reset marker: {}", marker_file.display());
                        return Ok(());
                    }
                    Err(e) => {
                        log::warn!("Failed to create factory reset marker: {}", e);
                        return Err(format!("Failed to create factory reset marker: {}", e));
                    }
                },
                Err(e) => {
                    log::warn!("Failed to create directory for marker: {}", e);
                    return Err(format!("Failed to create directory for marker: {}", e));
                }
            }
        }
    }

    Err("Could not determine app data directory".to_string())
}

/// Factory reset coordinator that performs all cleanup steps
#[tauri::command]
pub fn factory_reset() -> Result<(), String> {
    log::info!("Starting full factory reset");

    clear_application_data()?;
    clear_store_data()?;

    create_factory_reset_marker()?;
    schedule_webview_cleanup()?;

    Ok(())
}

/// Clears Tauri store configuration data
#[tauri::command]
pub fn clear_store_data() -> Result<(), String> {
    log::info!("Starting store data cleanup");

    // Define store file names
    let store_files_to_clear = [
        SETTINGS_FILE,
        SIGNALS_FILE,
        VERSION_FILE,
        &format!("{}{}", SETTINGS_FILE, BACKUP_EXT),
        &format!("{}{}", SIGNALS_FILE, BACKUP_EXT),
    ];

    // Clear Tauri store files from all possible locations
    let mut store_files = Vec::new();

    // Add paths from new Tauri app data directory
    if let Some(data_dir) = dirs::data_dir() {
        let app_dir = data_dir.join(TAURI_APP_ID);
        store_files.extend(
            store_files_to_clear
                .iter()
                .map(|file| Some(app_dir.join(file))),
        );
    }

    // Add paths from old rscoop directory
    if let Some(local_dir) = dirs::data_local_dir() {
        let old_dir = local_dir.join(OLD_APP_DIR);
        store_files.extend(
            store_files_to_clear
                .iter()
                .map(|file| Some(old_dir.join(file))),
        );
    }

    let mut cleared_count = 0;
    let mut failed_files = Vec::new();

    for store_file_option in store_files {
        if let Some(store_file) = store_file_option {
            if store_file.exists() && store_file.is_file() {
                log::info!("Attempting to remove store file: {}", store_file.display());

                if safe_remove_file(&store_file) {
                    cleared_count += 1;
                } else {
                    failed_files.push(store_file);
                }
            }
        }
    }

    log::info!("Store cleanup completed. Removed {} files", cleared_count);

    if !failed_files.is_empty() {
        log::warn!(
            "Failed to clear {} store files (likely in use):",
            failed_files.len()
        );
        for path in &failed_files {
            log::warn!("  - {}", path.display());
        }
        // Don't return error for locked files, they will be cleaned up on restart
    }

    Ok(())
}

/// Gets diagnostic information about the application's state.
#[tauri::command]
pub async fn get_debug_info(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let scoop_path = state.scoop_path();
    let apps_path = scoop_path.join("apps");

    log::info!("=== DEBUG INFO === get_debug_info called");

    // Try to read apps directory
    let app_count = if apps_path.is_dir() {
        fs::read_dir(&apps_path)
            .map(|entries| entries.count())
            .unwrap_or(0)
    } else {
        0
    };

    log::info!("=== DEBUG INFO === App count from disk: {}", app_count);

    // Check if apps directory exists
    let apps_dir_exists = apps_path.is_dir();

    // Check cache state
    let cache_guard = state.installed_packages.lock().await;
    let cache_info = if let Some(cache) = cache_guard.as_ref() {
        log::info!(
            "=== DEBUG INFO === Cache found with {} packages, fingerprint: {}",
            cache.packages.len(),
            cache.fingerprint
        );
        serde_json::json!({
            "cached_count": cache.packages.len(),
            "fingerprint": cache.fingerprint,
        })
    } else {
        log::info!("=== DEBUG INFO === No cache found (None)");
        serde_json::json!({
            "cached_count": 0,
            "fingerprint": null,
        })
    };
    drop(cache_guard); // Explicitly drop guard

    let debug_result = serde_json::json!({
        "timestamp": Local::now().to_rfc3339(),
        "scoop_path": scoop_path.display().to_string(),
        "apps_dir_exists": apps_dir_exists,
        "app_count": app_count,
        "cache_info": cache_info,
    });

    log::info!(
        "=== DEBUG INFO === Returning debug info: cached_count={}, app_count={}",
        debug_result["cache_info"]["cached_count"],
        app_count
    );

    Ok(debug_result)
}

/// Gets the current application logs from the logging system
#[tauri::command]
pub fn get_app_logs() -> Result<String, String> {
    let mut log_info = String::new();

    log_info.push_str("=== LOGGING INFORMATION ===\n\n");
    log_info.push_str("Current Logging Configuration:\n");
    log_info.push_str("- Logs are written to: disk files + stdout (terminal window)\n");
    log_info.push_str("- Log level: TRACE\n");
    log_info.push_str("- Log format: timestamp, level, target, message\n\n");

    log_info.push_str("Log File Locations:\n");

    if let Some(log_path) = get_log_dir() {
        if log_path.is_dir() {
            log_info.push_str(&format!("✓ Log directory: {}\n", log_path.display()));

            if let Ok(entries) = fs::read_dir(&log_path) {
                let mut log_files: Vec<PathBuf> = entries
                    .filter_map(|entry| {
                        entry.ok().and_then(|e| {
                            let path = e.path();
                            if path.is_file() && path.extension().map_or(false, |ext| ext == "log")
                            {
                                Some(path)
                            } else {
                                None
                            }
                        })
                    })
                    .collect();

                // Sort by modification time, newest first
                log_files.sort_by_key(|path| {
                    fs::metadata(path)
                        .and_then(|meta| meta.modified())
                        .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
                });
                log_files.reverse();

                if !log_files.is_empty() {
                    log_info.push_str("  Recent log files:\n");
                    for (i, path) in log_files.iter().take(5).enumerate() {
                        if let Ok(metadata) = fs::metadata(&path) {
                            let size = metadata.len();
                            log_info.push_str(&format!(
                                "  {}. {} ({} bytes)\n",
                                i + 1,
                                path.display(),
                                size
                            ));
                        }
                    }
                }
            }
        } else {
            log_info.push_str("  Logs not yet created (will be created on first run)\n");
            log_info.push_str(&format!("  Expected location: {}\n", log_path.display()));
        }
    } else {
        log_info.push_str("  Could not determine log directory location.\n");
    }

    log_info.push_str("\nTo View Logs:\n");
    log_info.push_str("1. Development Mode:\n");
    log_info.push_str("   $ npm run tauri dev\n");
    log_info.push_str("   - Logs appear in terminal AND are written to disk\n");
    log_info
        .push_str("   - Look for messages: '=== COLD START TRACE ===', '=== DEBUG INFO ==='\n\n");

    log_info.push_str("2. Production Build:\n");
    log_info.push_str("   - Logs are automatically written to disk\n");
    log_info.push_str("   - Check the log files in %LOCALAPPDATA%\\rscoop\\logs\\\n");
    log_info.push_str("   - Open in any text editor\n\n");

    log_info.push_str("3. Frontend Logs (Browser Console):\n");
    log_info.push_str("   - Press F12 to open Developer Tools\n");
    log_info.push_str("   - Check the Console tab for frontend errors and messages\n\n");

    log_info.push_str("Key Log Markers:\n");
    log_info
        .push_str("- Cold start: '=== COLD START TRACE ===' markers with [1/6] through [6/6]\n");
    log_info.push_str("- Debug info: '=== DEBUG INFO ===' markers\n");
    log_info.push_str("- Scoop operations: general backend operations\n");

    Ok(log_info)
}

/// Reads the current application log file
#[tauri::command]
pub fn read_app_log_file() -> Result<String, String> {
    // Determine log file path - check both new and old locations
    let log_files = vec![
        // Try new Tauri app data directory first (Roaming)
        dirs::data_dir().and_then(|d| Some(d.join(TAURI_APP_ID).join("logs").join("rscoop.log"))),
        // Fallback to old rscoop directory (Local)
        dirs::data_local_dir()
            .and_then(|d| Some(d.join(OLD_APP_DIR).join("logs").join("rscoop.log"))),
    ];

    // Try each potential log file location
    for log_file_option in log_files {
        if let Some(log_file) = log_file_option {
            match fs::read_to_string(&log_file) {
                Ok(content) => return Ok(content),
                Err(_) => continue, // Try next location
            }
        }
    }

    // If all locations failed, try to provide helpful message
    Ok(format!(
        "Log file not found at any expected location.\nChecked:\n- {}\n- {}\n\nLogs will be created after the first run.",
        dirs::data_dir()
            .map(|d| d.join(TAURI_APP_ID).join("logs").join("rscoop.log"))
            .unwrap_or_else(|| PathBuf::from("./logs/rscoop.log"))
            .display(),
        dirs::data_local_dir()
            .map(|d| d.join(OLD_APP_DIR).join("logs").join("rscoop.log"))
            .unwrap_or_else(|| PathBuf::from("./logs/rscoop.log"))
            .display()
    ))
}

/// Final cleanup to be called during application shutdown
#[tauri::command]
pub fn final_cleanup_on_exit() -> Result<(), String> {
    log::info!("Performing final cleanup before exit");

    // Give WebView processes a moment to release files
    std::thread::sleep(std::time::Duration::from_millis(1000));

    // Try to remove any remaining configuration files
    let final_cleanup_files = vec![
        dirs::data_dir().map(|d| d.join(TAURI_APP_ID).join(SETTINGS_FILE)),
        dirs::data_dir().map(|d| d.join(TAURI_APP_ID).join(SIGNALS_FILE)),
        dirs::data_local_dir().map(|d| d.join(OLD_APP_DIR).join(SETTINGS_FILE)),
        dirs::data_local_dir().map(|d| d.join(OLD_APP_DIR).join(SIGNALS_FILE)),
    ];

    for file_option in final_cleanup_files {
        if let Some(file) = file_option {
            if file.exists() {
                if safe_remove_file(&file) {
                    log::info!("Final cleanup removed: {}", file.display());
                }
            }
        }
    }

    // Schedule WebView cache cleanup for next startup
    schedule_webview_cleanup()?;

    Ok(())
}

/// Schedule WebView cache cleanup to run on next startup
fn schedule_webview_cleanup() -> Result<(), String> {
    log::info!("Scheduling WebView cache cleanup for next startup");

    if let Some(app_data_dir) = dirs::data_dir() {
        let cleanup_marker = app_data_dir.join(TAURI_APP_ID).join(WEBVIEW_CLEANUP_MARKER);
        if let Some(parent) = cleanup_marker.parent() {
            let _ = fs::create_dir_all(parent);
            let _ = fs::write(
                &cleanup_marker,
                format!("Scheduled at: {:?}", std::time::SystemTime::now()),
            );
        }
    }

    Ok(())
}

/// Perform scheduled WebView cleanup if marker exists
#[tauri::command]
pub fn perform_scheduled_webview_cleanup() -> Result<(), String> {
    if let Some(app_data_dir) = dirs::data_dir() {
        let cleanup_marker = app_data_dir.join(TAURI_APP_ID).join(WEBVIEW_CLEANUP_MARKER);

        if cleanup_marker.exists() {
            log::info!("Performing scheduled WebView cleanup on startup");

            // Remove the marker first
            let _ = fs::remove_file(&cleanup_marker);

            // Wait a bit more for WebView processes to fully initialize
            std::thread::sleep(std::time::Duration::from_millis(2000));

            // Try to clear WebView cache more aggressively on startup
            aggressive_webview_cleanup()?;
        }
    }

    Ok(())
}

/// Force clear WebView cache by terminating processes first
#[tauri::command]
pub fn force_clear_webview_cache() -> Result<(), String> {
    log::info!("Force clearing WebView cache");

    #[cfg(windows)]
    {
        use std::process::Command;
        let _ = Command::new("taskkill")
            .args(&["/F", "/IM", "msedgewebview2.exe"])
            .output();

        std::thread::sleep(std::time::Duration::from_millis(2000));
    }

    aggressive_webview_cleanup()
}

/// More aggressive WebView cleanup for startup
fn aggressive_webview_cleanup() -> Result<(), String> {
    log::info!("Performing WebView cleanup on startup");

    let webview_dirs = vec![
        dirs::data_dir().map(|d| d.join(TAURI_APP_ID).join("EBWebView")),
        dirs::data_local_dir().map(|d| d.join(TAURI_APP_ID).join("EBWebView")),
        dirs::cache_dir().map(|d| d.join(TAURI_APP_ID).join("EBWebView")),
    ];

    for webview_dir_option in webview_dirs {
        if let Some(webview_dir) = webview_dir_option {
            if webview_dir.exists() {
                log::info!("Found WebView directory: {}", webview_dir.display());

                // Try to remove the entire directory with a delay
                std::thread::sleep(std::time::Duration::from_millis(1000));

                match fs::remove_dir_all(&webview_dir) {
                    Ok(_) => {
                        log::info!(
                            "Successfully removed WebView directory: {}",
                            webview_dir.display()
                        );
                    }
                    Err(e) => {
                        log::info!(
                            "Could not remove WebView directory (this is normal): {} - {}",
                            webview_dir.display(),
                            e
                        );
                        // Don't fall back to individual file cleanup to avoid locking issues
                        log::info!(
                            "WebView directory will remain and be cleaned on next factory reset"
                        );
                    }
                }
            }
        }
    }

    Ok(())
}

fn get_log_dir() -> Option<PathBuf> {
    // First try to get the Tauri app data directory
    if let Some(app_data_dir) = dirs::data_dir() {
        let app_data_dir = app_data_dir.join(TAURI_APP_ID);
        if app_data_dir.exists() {
            return Some(app_data_dir.join("logs"));
        }
    }

    // Fallback to the old rscoop directory
    dirs::data_local_dir().map(|d| d.join(OLD_APP_DIR).join("logs"))
}
