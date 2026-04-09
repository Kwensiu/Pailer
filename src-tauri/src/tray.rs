use crate::commands::settings;
use crate::i18n::{DEFAULT_LANGUAGE, SUPPORTED_LOCALES};
use crate::state::AppState;
use crate::utils::{get_scoop_app_shortcuts_with_path, launch_scoop_app, ScoopAppShortcut};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

pub fn setup_system_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
    // Create a shared map to store app shortcuts for menu events
    let shortcuts_map: Arc<Mutex<HashMap<String, ScoopAppShortcut>>> =
        Arc::new(Mutex::new(HashMap::new()));
    app.manage(shortcuts_map.clone());

    // Create a debouncer for tray refreshes to prevent race conditions
    let refresh_in_progress: Arc<Mutex<bool>> = Arc::new(Mutex::new(false));
    app.manage(refresh_in_progress.clone());

    // Build the dynamic menu
    let menu = build_tray_menu(app, shortcuts_map.clone())?;

    let _tray = TrayIconBuilder::with_id("main")
        .tooltip("Pailer")
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    // Ensure window is shown and restored from minimized state
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
        })
        .on_menu_event(move |app, event| {
            let event_id = event.id().as_ref();
            match event_id {
                "quit" => {
                    app.exit(0);
                }
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "hide" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.hide();
                    }
                }
                "refreshApps" => {
                    // Refresh the tray menu
                    let app_handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        if let Err(e) = refresh_tray_menu(&app_handle).await {
                            log::error!("Failed to refresh tray menu: {}", e);
                        }
                    });
                }
                id if id.starts_with("app_") => {
                    // Handle Scoop app launches
                    let shortcuts_map =
                        app.state::<Arc<Mutex<HashMap<String, ScoopAppShortcut>>>>();
                    if let Ok(shortcuts) = shortcuts_map.inner().lock() {
                        if let Some(shortcut) = shortcuts.get(id) {
                            if let Err(e) =
                                launch_scoop_app(&shortcut.target_path, &shortcut.working_directory)
                            {
                                log::error!(
                                    "Failed to launch app {}: {}",
                                    shortcut.display_name,
                                    e
                                );
                            }
                        }
                    }
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}

fn fetch_current_language(app: &tauri::AppHandle<tauri::Wry>) -> String {
    // First try to get the language from settings
    if let Some(Some(lang_value)) =
        settings::get_config_value(app.clone(), "settings.language".to_string()).ok()
    {
        if let Some(lang_str) = lang_value.as_str() {
            if !lang_str.is_empty() {
                log::info!("Using language from settings: {}", lang_str);
                return lang_str.to_string();
            }
        }
    }

    // Fallback to system language detection (matching frontend logic)
    let system_lang = get_system_language();
    log::info!("Using detected system language: {}", system_lang);
    system_lang
}

fn get_system_language() -> String {
    // Try to get system locale, similar to frontend's sysLang() function
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::Globalization::GetUserDefaultLocaleName;

        let mut buffer = [0u16; 128];
        unsafe {
            let len = GetUserDefaultLocaleName(buffer.as_mut_ptr(), buffer.len() as i32);
            if len > 0 && len <= buffer.len() as i32 {
                // Convert UTF-16 to string with bounds checking
                let len_usize = len as usize;
                if len_usize > 0 {
                    let locale_bytes = &buffer[..len_usize - 1]; // -1 to exclude null terminator
                    let locale_string = String::from_utf16_lossy(locale_bytes);
                    let lang = locale_string.split('-').next().unwrap_or(DEFAULT_LANGUAGE);
                    return if SUPPORTED_LOCALES.contains(&lang) {
                        lang.to_string()
                    } else {
                        DEFAULT_LANGUAGE.to_string()
                    };
                }
            }
        }
    }

    // For non-Windows or if detection fails, try environment variables
    if let Ok(lang) = std::env::var("LANG") {
        let extracted_lang = lang.split('_').next().unwrap_or(DEFAULT_LANGUAGE);
        if SUPPORTED_LOCALES.contains(&extracted_lang) {
            return extracted_lang.to_string();
        }
    }

    // Default fallback
    DEFAULT_LANGUAGE.to_string()
}

fn build_tray_menu(
    app: &tauri::AppHandle<tauri::Wry>,
    shortcuts_map: Arc<Mutex<HashMap<String, ScoopAppShortcut>>>,
) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    let language = fetch_current_language(app);
    build_tray_menu_with_language(app, shortcuts_map, &language)
}

fn build_tray_menu_with_language(
    app: &tauri::AppHandle<tauri::Wry>,
    shortcuts_map: Arc<Mutex<HashMap<String, ScoopAppShortcut>>>,
    language: &str,
) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    let menu_strings = match crate::i18n::get_tray_locale_strings(language) {
        Ok(strings) => strings,
        Err(e) => {
            log::debug!(
                "Using default tray strings while localized strings are unavailable for '{}': {}",
                language,
                e
            );
            crate::i18n::default_tray_strings()
        }
    };

    // Extract strings with defaults
    let show_text = menu_strings
        .get("show")
        .and_then(|v| v.as_str())
        .unwrap_or("Show Pailer");
    let hide_text = menu_strings
        .get("hide")
        .and_then(|v| v.as_str())
        .unwrap_or("Hide Pailer");
    let refresh_apps_text = menu_strings
        .get("refreshApps")
        .and_then(|v| v.as_str())
        .unwrap_or("Refresh Apps");
    let scoop_apps_text = menu_strings
        .get("scoopApps")
        .and_then(|v| v.as_str())
        .unwrap_or("Scoop Apps");
    let quit_text = menu_strings
        .get("quit")
        .and_then(|v| v.as_str())
        .unwrap_or("Quit");

    // Basic menu items
    let show = tauri::menu::MenuItemBuilder::with_id("show", show_text).build(app)?;
    let hide = tauri::menu::MenuItemBuilder::with_id("hide", hide_text).build(app)?;
    let refresh_apps =
        tauri::menu::MenuItemBuilder::with_id("refreshApps", refresh_apps_text).build(app)?;

    let mut menu_items: Vec<Box<dyn tauri::menu::IsMenuItem<tauri::Wry>>> = Vec::new();
    menu_items.push(Box::new(show));
    menu_items.push(Box::new(hide));
    let shortcuts_result = if let Some(app_state) = app.try_state::<AppState>() {
        let scoop_path = app_state.scoop_path();
        get_scoop_app_shortcuts_with_path(scoop_path.as_path())
    } else {
        // Fallback to automatic detection if state is not available
        crate::utils::get_scoop_app_shortcuts()
    };

    if let Ok(shortcuts) = shortcuts_result {
        if !shortcuts.is_empty() {
            // Check if tray apps functionality is enabled
            let tray_apps_enabled = crate::commands::settings::get_config_value(
                app.clone(),
                "settings.window.trayAppsEnabled".to_string(),
            )
            .ok()
            .flatten()
            .and_then(|v| v.as_bool())
            .unwrap_or(true); // Default to true for backward compatibility

            if tray_apps_enabled {
                // Get configured tray apps list
                let configured_apps = crate::commands::settings::get_config_value(
                    app.clone(),
                    crate::config_keys::TRAY_APPS_LIST.to_string(),
                )
                .ok()
                .flatten()
                .and_then(|v| v.as_array().cloned())
                .unwrap_or_default();

                // Convert configured apps to a HashSet for fast lookup
                let configured_app_names: std::collections::HashSet<String> = configured_apps
                    .iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect();

                // Filter shortcuts based on configuration
                // If no apps configured, show none (user can add them in settings)
                let filtered_shortcuts: Vec<_> = if configured_app_names.is_empty() {
                    Vec::new() // Show no apps by default
                } else {
                    shortcuts
                        .into_iter()
                        .filter(|shortcut| configured_app_names.contains(&shortcut.name))
                        .collect()
                };

                if !filtered_shortcuts.is_empty() {
                    // Add separator before apps
                    let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
                    menu_items.push(Box::new(separator));

                    // Add "Scoop Apps" label
                    let apps_label =
                        tauri::menu::MenuItemBuilder::with_id("apps_label", scoop_apps_text)
                            .enabled(false)
                            .build(app)?;
                    menu_items.push(Box::new(apps_label));

                    // Build new shortcuts map first, then replace atomically
                    let mut new_shortcuts_map = HashMap::new();
                    for shortcut in filtered_shortcuts {
                        let menu_id = format!("app_{}", shortcut.name);
                        new_shortcuts_map.insert(menu_id.clone(), shortcut.clone());

                        let menu_item =
                            tauri::menu::MenuItemBuilder::with_id(&menu_id, &shortcut.display_name)
                                .build(app)?;
                        menu_items.push(Box::new(menu_item));
                    }

                    // Replace the old map atomically with error handling
                    if let Ok(mut map) = shortcuts_map.lock() {
                        *map = new_shortcuts_map;
                    } else {
                        log::error!("Failed to acquire shortcuts_map lock for atomic replacement - continuing with empty map");
                        // Continue with the menu build even if we can't update the shortcuts map
                        // This maintains backward compatibility with the original behavior
                    }
                }
            }
        }
    } else if let Err(e) = shortcuts_result {
        log::warn!("Failed to get Scoop app shortcuts: {}", e);
    }

    // Add separator and refresh option
    let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
    menu_items.push(Box::new(separator));
    menu_items.push(Box::new(refresh_apps));

    // Add quit option
    let separator2 = tauri::menu::PredefinedMenuItem::separator(app)?;
    let quit = tauri::menu::MenuItemBuilder::with_id("quit", quit_text).build(app)?;
    menu_items.push(Box::new(separator2));
    menu_items.push(Box::new(quit));

    // Build the menu
    let mut menu_builder = tauri::menu::MenuBuilder::new(app);
    for item in menu_items {
        menu_builder = menu_builder.item(&*item);
    }

    menu_builder.build()
}

/// Refresh the tray menu with updated Scoop apps
pub async fn refresh_tray_menu(app: &tauri::AppHandle<tauri::Wry>) -> Result<(), String> {
    log::info!("Refreshing tray menu...");

    let refresh_in_progress = app.state::<Arc<Mutex<bool>>>();

    // Check if a refresh is already in progress
    {
        let mut in_progress = refresh_in_progress
            .inner()
            .lock()
            .map_err(|e| format!("Failed to lock refresh flag: {}", e))?;
        if *in_progress {
            log::info!("Tray refresh already in progress, skipping...");
            return Ok(());
        }
        *in_progress = true;
    }

    // Get shortcuts map
    let shortcuts_map = app.state::<Arc<Mutex<HashMap<String, ScoopAppShortcut>>>>();

    // Clone the app handle for the async task
    let app_clone = app.clone();
    let shortcuts_map_clone = shortcuts_map.inner().clone();
    let refresh_flag_clone = refresh_in_progress.inner().clone();

    // Start the refresh task with proper error handling and flag reset
    tauri::async_runtime::spawn(async move {
        let result = perform_tray_refresh(&app_clone, shortcuts_map_clone).await;

        // ALWAYS reset the flag, regardless of success or failure
        if let Ok(mut flag) = refresh_flag_clone.lock() {
            *flag = false;
        } else {
            log::error!("Failed to reset refresh_in_progress flag after tray refresh attempt");
        }

        // Log the result
        match result {
            Ok(_) => log::info!("Tray menu refreshed successfully"),
            Err(e) => log::error!("Failed to perform tray refresh: {}", e),
        }
    });

    Ok(())
}

/// Internal function to perform the actual tray refresh
async fn perform_tray_refresh(
    app: &tauri::AppHandle<tauri::Wry>,
    shortcuts_map: Arc<Mutex<HashMap<String, ScoopAppShortcut>>>,
) -> Result<(), String> {
    // Rebuild the menu
    let new_menu = build_tray_menu(app, shortcuts_map)
        .map_err(|e| format!("Failed to build new menu: {}", e))?;

    // Update the tray icon menu
    if let Some(tray) = app.tray_by_id("main") {
        tray.set_menu(Some(new_menu))
            .map_err(|e| format!("Failed to set new menu: {}", e))?;
        log::info!("Tray menu refreshed successfully");
    } else {
        return Err("Tray icon not found".to_string());
    }

    Ok(())
}

pub fn show_system_notification_blocking(app: &tauri::AppHandle) {
    log::info!("Displaying blocking native dialog for tray notification");

    let language = fetch_current_language(app);

    let strings = match crate::i18n::get_tray_locale_strings(&language) {
        Ok(s) => s,
        Err(e) => {
            // Check for specific error types more reliably
            if e.contains("cache miss") || e.contains("No cached strings") {
                log::debug!(
                    "Using default tray strings (cache miss for language: {})",
                    language
                );
            } else {
                log::warn!("Failed to get notification strings: {}, using defaults", e);
            }
            crate::i18n::default_tray_strings()
        }
    };

    // Extract strings (now with local fallback)
    let title = strings
        .get("notificationTitle")
        .and_then(|v| v.as_str())
        .unwrap_or("Pailer - Minimized to Tray");
    let message = strings
        .get("notificationMessage")
        .and_then(|v| v.as_str())
        .unwrap_or("Pailer has been minimized to the system tray and will continue running in the background.\n\nYou can:\n• Click the tray icon to restore the window\n• Right-click the tray icon to access the context menu\n• Change this behavior in Settings > Window Behavior");
    let close_button = strings
        .get("closeAndDisable")
        .and_then(|v| v.as_str())
        .unwrap_or("Close and Disable Tray");
    let keep_button = strings
        .get("keepInTray")
        .and_then(|v| v.as_str())
        .unwrap_or("Keep in Tray");

    // Show a nice native dialog with information about tray behavior
    let result = app
        .dialog()
        .message(message)
        .title(title)
        .kind(MessageDialogKind::Info)
        .buttons(MessageDialogButtons::OkCancelCustom(
            close_button.to_string(),
            keep_button.to_string(),
        ))
        .blocking_show();

    // If user chose to close and disable tray, disable the setting and exit
    if result {
        // Disable close to tray setting
        let _ = settings::set_config_value(
            app.clone(),
            "window.closeToTray".to_string(),
            serde_json::json!(false),
        );

        log::info!("User chose to disable tray functionality. Exiting application.");
        app.exit(0);
    }
}

#[tauri::command]
pub async fn refresh_tray_apps_menu(app: tauri::AppHandle<tauri::Wry>) -> Result<(), String> {
    refresh_tray_menu(&app).await
}

#[tauri::command]
pub async fn refresh_tray_with_language(
    app: tauri::AppHandle<tauri::Wry>,
    language: String,
) -> Result<(), String> {
    let shortcuts_map = app
        .state::<Arc<Mutex<HashMap<String, ScoopAppShortcut>>>>()
        .inner()
        .clone();
    let new_menu = build_tray_menu_with_language(&app, shortcuts_map, &language)
        .map_err(|e| format!("Failed to build new menu: {}", e))?;

    if let Some(tray) = app.tray_by_id("main") {
        tray.set_menu(Some(new_menu))
            .map_err(|e| format!("Failed to set new menu: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn get_current_language(app: tauri::AppHandle<tauri::Wry>) -> Result<String, String> {
    let language = settings::get_config_value(app, "settings.language".to_string())
        .ok()
        .flatten()
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "en".to_string());

    Ok(language)
}

#[tauri::command]
pub fn get_scoop_app_shortcuts() -> Result<Vec<serde_json::Value>, String> {
    match crate::utils::get_scoop_app_shortcuts() {
        Ok(shortcuts) => {
            let result: Vec<serde_json::Value> = shortcuts
                .into_iter()
                .map(|shortcut| {
                    serde_json::json!({
                        "name": shortcut.name,
                        "display_name": shortcut.display_name
                    })
                })
                .collect();
            Ok(result)
        }
        Err(e) => Err(format!("Failed to get Scoop app shortcuts: {}", e)),
    }
}
