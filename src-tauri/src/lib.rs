// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod cold_start;
mod commands;
mod models;
mod state;
mod tray;
pub mod utils;
use std::path::PathBuf;
use crate::commands::settings::detect_scoop_path;
use tauri::{Emitter, Manager, WindowEvent};
use tauri_plugin_log::{Target, TargetKind};

// Constants for configuration keys
const BUCKET_AUTO_UPDATE_INTERVAL: &str = "buckets.autoUpdateInterval";
const BUCKET_LAST_AUTO_UPDATE_TS: &str = "buckets.lastAutoUpdateTs";
const BUCKET_AUTO_UPDATE_PACKAGES_ENABLED: &str = "buckets.autoUpdatePackagesEnabled";
const WINDOW_CLOSE_TO_TRAY: &str = "window.closeToTray";
const WINDOW_FIRST_TRAY_NOTIFICATION_SHOWN: &str = "window.firstTrayNotificationShown";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default().plugin(tauri_plugin_opener::init());

    // Add single instance plugin only on Windows
    #[cfg(windows)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // When a second instance is attempted, show and focus the existing window
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
        }));
    }

    // Set up logging with both stdout and file targets
    // Determine log directory - use LOCALAPPDATA\rscoop\logs on Windows
    let log_dir = if let Some(local_data) = dirs::data_local_dir() {
        local_data.join("rscoop").join("logs")
    } else {
        std::path::PathBuf::from("./logs")
    };

    // Clear existing log files on launch (only old ones)
    if log_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&log_dir) {
            for entry in entries.flatten() {
                if let Ok(metadata) = entry.metadata() {
                    if metadata.is_file() {
                        // Try to remove file, but don't panic if it fails
                        if let Err(e) = std::fs::remove_file(entry.path()) {
                            eprintln!("Failed to clear log file {:?}: {}", entry.path(), e);
                        }
                    }
                }
            }
        } else {
            eprintln!("Failed to read log directory: {:?}", log_dir);
        }
    }

    // Create log directory
    if let Err(e) = std::fs::create_dir_all(&log_dir) {
        eprintln!("Failed to create log directory {:?}: {}", log_dir, e);
    }

    let log_plugin = tauri_plugin_log::Builder::new()
        .targets([
            Target::new(TargetKind::Stdout),
            Target::new(TargetKind::Folder {
                path: log_dir.clone(),
                file_name: None,
            }),
        ])
        .level(log::LevelFilter::Trace)
        // Suppress verbose output from external crates
        .level_for("lnk", log::LevelFilter::Warn)
        .level_for("reqwest", log::LevelFilter::Warn)
        .level_for("tauri_plugin_updater", log::LevelFilter::Debug)
        .build();

    builder
        .plugin(log_plugin)
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            #[cfg(windows)]
            {
                // Check if installed via Scoop
                let is_scoop = utils::is_scoop_installation();
                log::info!("Application installed via Scoop: {}", is_scoop);

                // Only set up updater if not installed via Scoop
                if !is_scoop {
                    app.handle()
                        .plugin(tauri_plugin_updater::Builder::new().build())
                        .expect("failed to add updater plugin");
                }
            }

            let app_handle = app.handle().clone();
            let scoop_path = match utils::resolve_scoop_root(app_handle) {
                Ok(path) => path,
                Err(e) => {
                    log::warn!("Could not resolve scoop root path: {}", e);
                    // Try to detect scoop path or use default
                    match detect_scoop_path() {
                        Ok(path) => PathBuf::from(path),
                        Err(_) => {
                            #[cfg(windows)]
                            {
                                std::path::PathBuf::from("C:\\scoop")
                            }
                            #[cfg(not(windows))]
                            {
                                std::path::PathBuf::from("/usr/local/scoop")
                            }
                        }
                    }
                }
            };

            app.manage(state::AppState::new(scoop_path));
            
            // Ensure main window is shown
            if let Some(window) = app.get_webview_window("main") {
                if let Err(e) = window.show() {
                    log::warn!("Failed to show main window: {}", e);
                }
                if let Err(e) = window.set_focus() {
                    log::warn!("Failed to focus main window: {}", e);
                }
            }

            // Set up system tray
            if let Err(e) = tray::setup_system_tray(&app.handle()) {
                log::error!("Failed to setup system tray: {}", e);
            }

            // Spawn background task for auto bucket updates with wall-clock persistence
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                use std::time::{Duration, SystemTime, UNIX_EPOCH};

                // Helper to parse interval string into seconds
                let parse_interval = |val: &str| -> Option<u64> {
                    match val {
                        "24h" | "1d" => Some(86400),
                        "7d" | "1w" => Some(604800),
                        "1h" => Some(3600),
                        "6h" => Some(21600),
                        off if off == "off" => None,
                        custom if custom.starts_with("custom:") => custom[7..].parse::<u64>().ok(),
                        numeric => numeric.parse::<u64>().ok(),
                    }
                };

                loop {
                    // Read interval each loop so changes apply promptly
                    let interval_raw = commands::settings::get_config_value(
                        app_handle.clone(),
                        BUCKET_AUTO_UPDATE_INTERVAL.to_string(),
                    )
                    .ok()
                    .flatten()
                    .and_then(|v| v.as_str().map(|s| s.to_string()))
                    .unwrap_or_else(|| "off".to_string());

                    let interval_secs_opt = parse_interval(&interval_raw);
                    if interval_secs_opt.is_none() {
                        // Off: poll more frequently for changes
                        log::trace!("[scheduler] interval='off' polling again in 30s");
                        tokio::time::sleep(Duration::from_secs(30)).await;
                        continue;
                    }
                    let interval_secs = interval_secs_opt.unwrap();

                    // Load last run timestamp
                    let last_ts_val = commands::settings::get_config_value(
                        app_handle.clone(),
                        BUCKET_LAST_AUTO_UPDATE_TS.to_string(),
                    )
                    .ok()
                    .flatten();
                    let last_ts = last_ts_val
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0u64);

                    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
                    let elapsed = if last_ts == 0 { interval_secs } else { now.saturating_sub(last_ts) };

                    if last_ts == 0 {
                        log::trace!("[scheduler] no previous run recorded; treating as overdue");
                    }

                    if elapsed >= interval_secs {
                        log::info!("Auto bucket update task running (interval='{}', seconds={}, elapsed={})", interval_raw, interval_secs, elapsed);
                        let run_started_at = now;
                        
                        // Emit start event to show modal
                        if let Some(window) = app_handle.get_webview_window("main") {
                            if let Err(e) = window.emit("auto-operation-start", "Updating buckets...") {
                                log::warn!("Failed to emit auto-operation-start event: {}", e);
                            }
                            
                            if let Err(e) = window.emit("operation-output", serde_json::json!({
                                "line": "Starting automatic bucket update...",
                                "source": "stdout"
                            })) {
                                log::warn!("Failed to emit operation-output event: {}", e);
                            }
                        }
                        
                        // Clone app_handle for use in the spawned task
                        let inner_app_handle = app_handle.clone();
                        // Spawn async task for bucket updates
                        tauri::async_runtime::spawn(async move {
                            // Get app state inside the async task where it's needed
                            let app_state = inner_app_handle.state::<state::AppState>().clone();
                            match commands::bucket_install::update_all_buckets(app_state).await {
                                Ok(results) => {
                                    let successes = results.iter().filter(|r| r.success).count();
                                    log::info!(
                                        "Auto bucket update completed: {} successes / {} total",
                                        successes,
                                        results.len()
                                    );
                                    
                                    // Stream results to modal
                                    if let Some(window) = inner_app_handle.get_webview_window("main") {
                                        for result in &results {
                                            let line = if result.success {
                                                format!("✓ Updated bucket: {}", result.bucket_name)
                                            } else {
                                                format!("✗ Failed to update {}: {}", result.bucket_name, result.message)
                                            };
                                            
                                            if let Err(e) = window.emit("operation-output", serde_json::json!({
                                                "line": line,
                                                "source": if result.success { "stdout" } else { "stderr" }
                                            })) {
                                                log::warn!("Failed to emit operation-output event: {}", e);
                                            }
                                        }
                                        
                                        if let Err(e) = window.emit("operation-finished", serde_json::json!({
                                            "success": successes == results.len(),
                                            "message": format!("Bucket update completed: {} of {} succeeded", successes, results.len())
                                        })) {
                                            log::warn!("Failed to emit operation-finished event: {}", e);
                                        }
                                    }
                                    
                                    // Persist last run timestamp (record even if partial successes to avoid hammering)
                                    let _ = commands::settings::set_config_value(
                                        inner_app_handle.clone(),
                                        BUCKET_LAST_AUTO_UPDATE_TS.to_string(),
                                        serde_json::json!(run_started_at),
                                    );

                                    // After buckets update, optionally run package updates
                                    let auto_update_packages = commands::settings::get_config_value(
                                        inner_app_handle.clone(),
                                        BUCKET_AUTO_UPDATE_PACKAGES_ENABLED.to_string(),
                                    )
                                    .ok()
                                    .flatten()
                                    .and_then(|v| v.as_bool())
                                    .unwrap_or(false);

                                    if auto_update_packages {
                                        log::info!("Auto package update task running after bucket refresh (headless with events)");
                                        let state = inner_app_handle.state::<state::AppState>();
                                        if let Some(window) = inner_app_handle.get_webview_window("main") {
                                            if let Err(e) = window.emit("auto-operation-start", "Updating packages...") {
                                                log::warn!("Failed to emit auto-operation-start event: {}", e);
                                            }
                                            
                                            if let Err(e) = window.emit("operation-output", serde_json::json!({
                                                "line": "Starting automatic package update...",
                                                "source": "stdout"
                                            })) {
                                                log::warn!("Failed to emit operation-output event: {}", e);
                                            }
                                        }
                                        match commands::update::update_all_packages_headless(inner_app_handle.clone(), state).await {
                                            Ok(_) => {
                                                if let Some(window) = inner_app_handle.get_webview_window("main") {
                                                    if let Err(e) = window.emit("operation-output", serde_json::json!({
                                                        "line": "Package update completed successfully.",
                                                        "source": "stdout"
                                                    })) {
                                                        log::warn!("Failed to emit operation-output event: {}", e);
                                                    }
                                                    
                                                    if let Err(e) = window.emit("operation-finished", serde_json::json!({
                                                        "success": true,
                                                        "message": "Automatic package update completed successfully"
                                                    })) {
                                                        log::warn!("Failed to emit operation-finished event: {}", e);
                                                    }
                                                }
                                            }
                                            Err(e) => {
                                                log::warn!("Auto package headless update failed: {}", e);
                                                if let Some(window) = inner_app_handle.get_webview_window("main") {
                                                    if let Err(e) = window.emit("operation-output", serde_json::json!({
                                                        "line": format!("Error: {}", e),
                                                        "source": "stderr"
                                                    })) {
                                                        log::warn!("Failed to emit operation-output event: {}", e);
                                                    }
                                                    
                                                    if let Err(e) = window.emit("operation-finished", serde_json::json!({
                                                        "success": false,
                                                        "message": format!("Automatic package update failed: {}", e)
                                                    })) {
                                                        log::warn!("Failed to emit operation-finished event: {}", e);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                                Err(e) => {
                                    log::warn!("Auto bucket update failed: {}", e);
                                    
                                    // Emit failure to modal
                                    if let Some(window) = inner_app_handle.get_webview_window("main") {
                                        if let Err(e) = window.emit("operation-output", serde_json::json!({
                                            "line": format!("Error: {}", e),
                                            "source": "stderr"
                                        })) {
                                            log::warn!("Failed to emit operation-output event: {}", e);
                                        }
                                        
                                        if let Err(e) = window.emit("operation-finished", serde_json::json!({
                                            "success": false,
                                            "message": format!("Bucket update failed: {}", e)
                                        })) {
                                            log::warn!("Failed to emit operation-finished event: {}", e);
                                        }
                                    }
                                    
                                    // Even on failure, set timestamp to avoid rapid retry storms
                                    let _ = commands::settings::set_config_value(
                                        inner_app_handle.clone(),
                                        BUCKET_LAST_AUTO_UPDATE_TS.to_string(),
                                        serde_json::json!(run_started_at),
                                    );
                                }
                            }
                        });
                        // Loop again immediately to compute next run
                        continue;
                    }

                    // Not yet due: sleep in chunks until due or interval changes
                    let remaining = interval_secs - elapsed; // > 0 here
                    let chunk = if remaining <= 60 { remaining } else { 60 }; // Max 60s granularity
                    let next_run_at = now + remaining;
                    log::trace!(
                        "[scheduler] next run in {}s (at ts={})",
                        remaining,
                        next_run_at
                    );
                    tokio::time::sleep(Duration::from_secs(chunk)).await;
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let app_handle = window.app_handle().clone();

                // Check if close to tray is enabled in settings
                let close_to_tray = match commands::settings::get_config_value(
                    app_handle.clone(),
                    WINDOW_CLOSE_TO_TRAY.to_string(),
                ) {
                    Ok(Some(value)) => value.as_bool().unwrap_or(true), // Default to true
                    _ => true, // Default to true if setting doesn't exist
                };

                if close_to_tray {
                    // Check if first notification has been shown
                    let first_notification_shown = match commands::settings::get_config_value(
                        app_handle.clone(),
                        WINDOW_FIRST_TRAY_NOTIFICATION_SHOWN.to_string(),
                    ) {
                        Ok(Some(value)) => value.as_bool().unwrap_or(false),
                        _ => false,
                    };

                    // Hide the window instead of closing the app
                    if let Err(e) = window.hide() {
                        log::warn!("Failed to hide window: {}", e);
                    }
                    api.prevent_close();

                    // Show notification if it's the first time
                    if !first_notification_shown {
                        // Mark that we've shown the first notification
                        let _ = commands::settings::set_config_value(
                            app_handle.clone(),
                            WINDOW_FIRST_TRAY_NOTIFICATION_SHOWN.to_string(),
                            serde_json::json!(true),
                        );

                        // Show the native dialog on a separate thread to avoid blocking
                        let app_clone = app_handle.clone();
                        std::thread::spawn(move || {
                            tray::show_system_notification_blocking(&app_clone);
                        });
                    }
                } else {
                    // Let the window close normally (exit app)
                    // Don't call prevent_close(), so the app will exit
                }
            }
        })
        .on_page_load(|window, _payload| {
            cold_start::run_cold_start(window.app_handle().clone());
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            commands::search::search_scoop,
            commands::installed::get_installed_packages_full,
            commands::installed::refresh_installed_packages,
            commands::installed::get_package_path,
            commands::info::get_package_info,
            commands::install::install_package,
            commands::manifest::get_package_manifest,
            commands::updates::check_for_updates,
            commands::update::update_package,
            commands::update::update_all_packages,
            commands::uninstall::uninstall_package,
            commands::uninstall::clear_package_cache,
            commands::status::check_scoop_status,
            commands::settings::get_config_value,
            commands::settings::set_config_value,
            commands::settings::get_scoop_path,
            commands::settings::set_scoop_path,
            commands::settings::get_virustotal_api_key,
            commands::settings::set_virustotal_api_key,
            commands::settings::get_scoop_proxy,
            commands::settings::set_scoop_proxy,
            commands::settings::detect_scoop_path,
            commands::settings::validate_scoop_directory,
            commands::settings::run_scoop_command,
            commands::settings::run_powershell_command,
            commands::settings::get_scoop_config,
            commands::virustotal::scan_package,
            commands::auto_cleanup::run_auto_cleanup,
            commands::doctor::checkup::run_scoop_checkup,
            commands::doctor::cleanup::cleanup_all_apps,
            commands::doctor::cleanup::cleanup_all_apps_force,
            commands::doctor::cleanup::cleanup_outdated_cache,
            commands::doctor::cache::list_cache_contents,
            commands::doctor::cache::clear_cache,
            commands::doctor::shim::list_shims,
            commands::doctor::shim::remove_shim,
            commands::doctor::shim::alter_shim,
            commands::doctor::shim::add_shim,
            commands::hold::list_held_packages,
            commands::hold::hold_package,
            commands::hold::unhold_package,
            commands::bucket::get_buckets,
            commands::bucket::get_bucket_info,
            commands::bucket::get_bucket_manifests,
            commands::bucket_install::install_bucket,
            commands::bucket_install::validate_bucket_install,
            commands::bucket_install::update_bucket,
            commands::bucket_install::remove_bucket,
            commands::bucket_search::search_buckets,
            commands::bucket_search::get_expanded_search_info,
            commands::bucket_search::get_default_buckets,
            commands::bucket_search::clear_bucket_cache,
            commands::bucket_search::check_bucket_cache_exists,
            commands::app_info::is_scoop_installation,
            commands::app_info::is_cwd_mismatch,
            commands::app_info::close_app,
            commands::linker::get_package_versions,
            commands::linker::switch_package_version,
            commands::linker::get_versioned_packages,
            commands::linker::debug_package_structure,
            commands::linker::change_package_bucket,
            commands::debug::get_debug_info,
            commands::debug::get_app_logs,
            commands::debug::read_app_log_file,
            commands::version::check_and_update_version,
            commands::startup::is_auto_start_enabled,
            commands::startup::set_auto_start_enabled,
            cold_start::is_cold_start_ready,
            tray::refresh_tray_apps_menu
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}