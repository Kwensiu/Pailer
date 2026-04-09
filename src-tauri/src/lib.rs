// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod cold_start;
mod commands;
mod i18n;
mod models;
mod scheduler;
mod state;
mod tray;
pub mod utils;

use std::path::PathBuf;
use tauri::{Manager, WindowEvent};
use tauri_plugin_log::{Target, TargetKind};

// Use a constant group to organize related configuration key
mod config_keys {
    pub const WINDOW_CLOSE_TO_TRAY: &str = "window.closeToTray";
    pub const WINDOW_FIRST_TRAY_NOTIFICATION_SHOWN: &str = "window.firstTrayNotificationShown";
    pub const TRAY_APPS_LIST: &str = "tray.appsList";
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(windows)]
    set_explicit_app_user_model_id();

    // Set up panic handler for better crash reporting
    std::panic::set_hook(Box::new(|panic_info| {
        let location = panic_info
            .location()
            .unwrap_or_else(|| panic_info.location().unwrap());
        let message = if let Some(s) = panic_info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = panic_info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "Unknown panic message".to_string()
        };

        eprintln!(
            "PANIC: {} at {}:{}:{}",
            message,
            location.file(),
            location.line(),
            location.column()
        );

        // Try to write to log file if possible
        if let Some(log_dir) = dirs::data_dir().map(|dir| dir.join("com.pailer.ks").join("logs")) {
            if let Ok(mut log_file) = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(log_dir.join("panic.log"))
            {
                use std::io::Write;
                let _ = writeln!(
                    log_file,
                    "[{}] PANIC: {} at {}:{}:{}",
                    chrono::Utc::now().format("%Y-%m-%d %H:%M:%S"),
                    message,
                    location.file(),
                    location.line(),
                    location.column()
                );
            }
        }
    }));
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init());

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

    // Determine log directory path
    let log_dir = dirs::data_dir()
        .map(|dir| dir.join("com.pailer.ks").join("logs"))
        .unwrap_or_else(|| PathBuf::from("./logs"));

    cleanup_old_logs(&log_dir);

    // Create log directory if it does not exist
    if let Err(e) = std::fs::create_dir_all(&log_dir) {
        eprintln!("Failed to create log directory {:?}: {}", log_dir, e);
    }

    // Configure logging plugin with multiple targets
    let log_plugin = tauri_plugin_log::Builder::new()
        .targets([
            Target::new(TargetKind::Stdout),
            Target::new(TargetKind::Folder {
                path: log_dir,
                file_name: None,
            }),
        ])
        .level(if cfg!(debug_assertions) {
            log::LevelFilter::Trace
        } else {
            log::LevelFilter::Info
        })
        .level_for("lnk", log::LevelFilter::Warn)
        .level_for("reqwest", log::LevelFilter::Warn)
        .level_for("tauri_plugin_updater", log::LevelFilter::Debug)
        .build();

    builder
        .plugin(log_plugin)
        .plugin(tauri_plugin_store::Builder::new().build())
        // Initialize the updater plugin only on Windows and only if not installed via Scoop
        .plugin({
            #[cfg(windows)]
            {
                if !utils::is_scoop_installation() {
                    tauri_plugin_updater::Builder::new().build()
                } else {
                    tauri::plugin::Builder::new("empty").build()
                }
            }
            #[cfg(not(windows))]
            {
                tauri::plugin::Builder::new("empty").build()
            }
        })
        .setup(|app| {
            // Windows-specific setup
            #[cfg(windows)]
            setup_windows_specific(app)?;

            // Try to resolve Scoop path, but don't block startup if it fails
            // Use a default/temporary path and let the frontend handle configuration
            let (scoop_path, configured) = match resolve_scoop_path(app.handle().clone()) {
                Ok(path) => {
                    log::info!("Resolved Scoop path: {}", path.display());
                    (path, true)
                }
                Err(e) => {
                    log::warn!("Failed to resolve Scoop path during startup: {}", e);
                    log::warn!("User will be prompted to configure Scoop path in the frontend.");
                    // Use a default path but mark as unconfigured
                    (PathBuf::from("C:\\Scoop"), false)
                }
            };

            app.manage(state::AppState::new(scoop_path, configured));

            #[cfg(windows)]
            {
                let app_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    match commands::doctor::notify_icon_settings::apply_pending_self_update_tray_migration(app_handle).await {
                        Ok(Some(result)) => {
                            if !result.failed.is_empty() {
                                log::warn!(
                                    "[tray-migration][self-update] startup apply completed with {} failures",
                                    result.failed.len()
                                );
                            }
                        }
                        Ok(None) => {}
                        Err(e) => {
                            log::warn!(
                                "[tray-migration][self-update] startup apply failed: {}",
                                e
                            );
                        }
                    }
                });
            }

            // Show the main application window
            show_main_window(app)?;

            // Tray will be created when frontend syncs locale data
            // No need for delayed initialization here

            // Start background tasks
            scheduler::start_background_tasks(app.handle().clone());

            Ok(())
        })
        .on_window_event(|window, event| handle_window_event(window, &event))
        .on_page_load(|window, _| {
            cold_start::run_cold_start(window.app_handle().clone());
        })
        .invoke_handler(tauri::generate_handler![
            commands::search::search_scoop,
            commands::search::get_package_buckets,
            commands::self_update::update_pailer_self,
            commands::self_update::can_self_update,
            commands::installed::get_installed_packages_full,
            commands::installed::refresh_installed_packages,
            commands::installed::get_package_path,
            commands::installed::get_current_version_install_time,
            commands::installed::get_current_version_update_date,
            commands::package_icon::get_installed_package_icons,
            commands::info::get_package_info,
            commands::info::get_package_run_entries,
            commands::info::run_package_entry,
            commands::install::install_package,
            commands::scoop::retry_operation_elevated,
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
            commands::settings::get_scoop_path_manually_configured,
            commands::settings::get_virustotal_api_key,
            commands::settings::set_virustotal_api_key,
            commands::settings::get_scoop_proxy,
            commands::settings::set_scoop_proxy,
            commands::settings::auto_detect_scoop_path,
            commands::settings::path_exists,
            commands::settings::get_default_scoop_config,
            commands::settings::validate_scoop_directory,
            commands::settings::check_directory_exists,
            commands::settings::run_scoop_command,
            commands::settings::run_powershell_command,
            commands::settings::get_scoop_config,
            commands::settings::update_scoop_config,
            commands::settings::get_scoop_config_directory,
            commands::settings::set_powershell_exe,
            commands::settings::get_available_powershell_executables,
            commands::powershell::request_cancel_operation,
            commands::virustotal::scan_package,
            commands::auto_cleanup::run_auto_cleanup,
            commands::doctor::checkup::run_scoop_checkup,
            commands::doctor::cleanup::cleanup_all_apps,
            commands::doctor::cleanup::cleanup_all_apps_force,
            commands::doctor::cleanup::cleanup_all_apps_smart,
            commands::doctor::cleanup::cleanup_outdated_cache,
            commands::doctor::cleanup::remove_cache_for_specific_packages,
            commands::doctor::cleanup::remove_all_cache_with_scoop,
            commands::doctor::cache::list_cache_contents,
            commands::doctor::cache::clear_cache,
            commands::doctor::versioned_apps::get_versioned_apps,
            commands::doctor::versioned_apps::switch_app_version,
            commands::doctor::versioned_apps::delete_app_version,
            commands::doctor::versioned_apps::remove_versioned_apps,
            commands::doctor::shim::list_shims,
            commands::doctor::shim::remove_shim,
            commands::doctor::shim::alter_shim,
            commands::doctor::shim::add_shim,
            commands::doctor::shim::update_shim_args,
            commands::doctor::notify_icon_settings::preview_dedupe_notify_icon_settings,
            commands::doctor::notify_icon_settings::apply_dedupe_notify_icon_settings,
            commands::doctor::notify_icon_settings::apply_single_dedupe_notify_icon_pair,
            commands::doctor::notify_icon_settings::prepare_tray_config_migration,
            commands::doctor::notify_icon_settings::finalize_tray_config_migration,
            commands::doctor::notify_icon_settings::discard_tray_config_migration,
            commands::hold::list_held_packages,
            commands::hold::hold_package,
            commands::hold::unhold_package,
            commands::bucket::get_buckets,
            commands::bucket::get_bucket_info,
            commands::bucket::get_bucket_manifests,
            commands::bucket::get_bucket_branches,
            commands::bucket::switch_bucket_branch,
            commands::bucket_install::install_bucket,
            commands::bucket_install::validate_bucket_install,
            commands::bucket_install::update_bucket,
            commands::bucket_install::update_all_buckets,
            commands::bucket_install::remove_bucket,
            commands::bucket_search::search_buckets,
            // commands::bucket_search::get_expanded_search_info,
            commands::bucket_search::get_default_buckets,
            commands::bucket_search::clear_bucket_cache,
            commands::bucket_search::check_bucket_cache_exists,
            commands::bucket_search::get_bucket_cache_info,
            commands::bucket_search::refresh_bucket_cache_if_needed,
            commands::app_info::is_scoop_installation,
            commands::linker::get_package_versions,
            commands::linker::switch_package_version,
            commands::linker::analyze_package_fast_switch,
            commands::linker::get_versioned_packages,
            commands::linker::debug_package_structure,
            commands::linker::change_package_bucket,
            commands::debug::get_debug_info,
            commands::debug::get_app_logs,
            commands::debug::read_app_log_file,
            commands::debug::get_app_data_dir,
            commands::debug::get_log_dir_cmd,
            commands::debug::get_log_retention_days,
            commands::debug::set_log_retention_days,
            commands::debug::check_factory_reset_marker,
            commands::debug::clear_application_data,
            commands::debug::clear_store_data,
            commands::debug::clear_registry_data,
            commands::debug::clear_webview_cache,
            commands::debug::factory_reset,
            commands::debug::final_cleanup_on_exit,
            commands::debug::perform_scheduled_webview_cleanup,
            commands::version::check_and_update_version,
            commands::startup::is_auto_start_enabled,
            commands::startup::set_auto_start_enabled,
            commands::startup::is_silent_startup_enabled,
            commands::startup::set_silent_startup_enabled,
            commands::startup::cleanup_startup_entries,
            cold_start::is_cold_start_ready,
            tray::refresh_tray_apps_menu,
            tray::get_current_language,
            tray::get_scoop_app_shortcuts,
            i18n::update_backend_tray_strings,
            commands::update_config::reload_update_config,
            commands::update_config::get_update_channel,
            commands::update_config::get_update_info_for_channel,
            commands::test_update::test_update_config,
            commands::test_update::get_current_update_channel,
            commands::fallback_update::check_for_fallback_update,
            commands::fallback_update::download_and_install_fallback_update,
            commands::fallback_update::get_current_version,
            utils::execute_custom_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(windows)]
fn set_explicit_app_user_model_id() {
    use windows_sys::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID;

    // Keep AppUserModelID stable across updates so shell preferences remain associated.
    let app_id_wide: Vec<u16> = "com.pailer.ks\0".encode_utf16().collect();
    unsafe {
        let hr = SetCurrentProcessExplicitAppUserModelID(app_id_wide.as_ptr());
        if hr < 0 {
            eprintln!(
                "Failed to set explicit AppUserModelID to com.pailer.ks (HRESULT={:#X})",
                hr
            );
        }
    }
}

// Helper function: Clean up old log files in the specified directory
fn cleanup_old_logs(log_dir: &PathBuf) {
    if !log_dir.exists() {
        return;
    }

    if let Ok(entries) = std::fs::read_dir(log_dir) {
        let mut removed_count = 0;
        let mut failed_count = 0;

        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    match std::fs::remove_file(entry.path()) {
                        Ok(_) => removed_count += 1,
                        Err(e) => {
                            log::debug!("Failed to remove log file {:?}: {}", entry.path(), e);
                            failed_count += 1;
                        }
                    }
                }
            }
        }

        if removed_count > 0 || failed_count > 0 {
            log::info!(
                "Log cleanup completed: {} removed, {} failed",
                removed_count,
                failed_count
            );
        }
    } else {
        log::debug!("Could not read log directory: {:?}", log_dir);
    }
}

// Windows-specific setup
#[cfg(windows)]
fn setup_windows_specific(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Only configure updater if not installed via Scoop
    if !utils::is_scoop_installation() {
        // Configure updater based on the current channel setting
        let app_handle = app.handle().clone();
        tauri::async_runtime::spawn(async move {
            if let Err(e) =
                commands::update_config::configure_updater_for_channel(&app_handle).await
            {
                log::error!("Failed to configure updater on startup: {}", e);
            }
        });

        log::info!("Updater plugin initialized successfully");
    }
    Ok(())
}

// Resolve Scoop installation path - Windows only
// Returns error if path cannot be resolved (no config + auto-detection failed)
fn resolve_scoop_path(app_handle: tauri::AppHandle) -> Result<PathBuf, Box<dyn std::error::Error>> {
    // First, try to get configured path
    match utils::resolve_scoop_root(app_handle.clone()) {
        Ok(path) => Ok(path),
        Err(e) => {
            log::warn!("Could not resolve scoop root path from config: {}", e);

            // Try auto-detection on first launch
            log::info!("Attempting auto-detection of Scoop installation...");
            match crate::commands::settings::auto_detect_scoop_path() {
                Ok(detected_path) => {
                    log::info!("Auto-detected Scoop path: {}", detected_path);

                    // Persist the detected path for future launches
                    if let Err(save_err) = crate::commands::settings::set_scoop_path(
                        app_handle.clone(),
                        detected_path.clone(),
                    ) {
                        log::warn!("Failed to persist auto-detected path: {}", save_err);
                    } else {
                        log::info!("Auto-detected path saved to configuration");
                    }

                    Ok(PathBuf::from(detected_path))
                }
                Err(detect_err) => {
                    log::error!("Auto-detection failed: {}", detect_err);
                    Err(format!(
                        "Cannot resolve Scoop path: {}. Please configure manually in settings.",
                        detect_err
                    )
                    .into())
                }
            }
        }
    }
}

// Show the main application windows
fn show_main_window(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Check if silent startup is enabled
    let should_start_silently = commands::startup::is_silent_startup_enabled().unwrap_or(false);

    if let Some(window) = app.get_webview_window("main") {
        if should_start_silently {
            // Start minimized - don't show the window initially
            window.hide()?;
        } else {
            window.show()?;
            window.set_focus()?;
        }
    }
    Ok(())
}

// Handle window events such as close requests
fn handle_window_event(window: &tauri::Window, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event {
        let app_handle = window.app_handle().clone();

        // Check if "close to tray" is enabled in settings
        let close_to_tray = commands::settings::get_config_value(
            app_handle.clone(),
            config_keys::WINDOW_CLOSE_TO_TRAY.to_string(),
        )
        .ok()
        .flatten()
        .and_then(|v| v.as_bool())
        .unwrap_or(true);

        if close_to_tray {
            // Hide the window instead of closing the app
            if let Err(e) = window.hide() {
                log::warn!("Failed to hide window: {}", e);
            }
            api.prevent_close();

            // Check if the first tray notification has been shown
            let first_notification_shown = commands::settings::get_config_value(
                app_handle.clone(),
                config_keys::WINDOW_FIRST_TRAY_NOTIFICATION_SHOWN.to_string(),
            )
            .ok()
            .flatten()
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

            if !first_notification_shown {
                // Mark the notification as shown
                let _ = commands::settings::set_config_value(
                    app_handle.clone(),
                    config_keys::WINDOW_FIRST_TRAY_NOTIFICATION_SHOWN.to_string(),
                    serde_json::json!(true),
                );

                // Show system notification in a separate thread
                std::thread::spawn(move || {
                    tray::show_system_notification_blocking(&app_handle);
                });
            }
        }
    }
}
