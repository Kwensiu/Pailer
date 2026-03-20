use serde_json::Value;
use std::collections::HashMap;
use std::sync::{Mutex, atomic::{AtomicBool, Ordering}};

// Language configuration constants
pub const SUPPORTED_LOCALES: &[&str] = &["en", "zh"];
pub const DEFAULT_LANGUAGE: &str = "en";

static TRAY_STRINGS: std::sync::OnceLock<Mutex<HashMap<String, Value>>> = std::sync::OnceLock::new();
static TRAY_INITIALIZED: AtomicBool = AtomicBool::new(false);

fn get_tray_strings_cache() -> &'static Mutex<HashMap<String, Value>> {
    TRAY_STRINGS.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn get_tray_locale_strings(language: &str) -> Result<Value, String> {
    let cache = get_tray_strings_cache();
    
    match cache.lock() {
        Ok(strings) => {
            if let Some(cached) = strings.get(language) {
                return Ok(cached.clone());
            }
            log::debug!("No tray strings cached for language: {}", language);
            Err("No cached strings found".to_string())
        }
        Err(e) => {
            log::error!("Failed to acquire tray strings lock: {:?}", e);
            Err("Failed to acquire lock".to_string())
        }
    }
}

#[tauri::command]
pub fn update_backend_tray_strings(app: tauri::AppHandle, language: String, tray_strings: Value) -> Result<(), String> {
    let cache = get_tray_strings_cache();
    match cache.lock() {
        Ok(mut strings) => {
            strings.insert(language.clone(), tray_strings);
            drop(strings);
            
            if !TRAY_INITIALIZED.swap(true, Ordering::SeqCst) {
                if let Err(e) = crate::tray::setup_system_tray(&app) {
                    log::error!("Failed to create tray: {}", e);
                    TRAY_INITIALIZED.store(false, Ordering::SeqCst);
                }
            } else {
                let app_handle = app.clone();
                let lang = language.clone();
                tauri::async_runtime::block_on(async move {
                    if let Err(e) = crate::tray::refresh_tray_with_language(app_handle, lang).await {
                        log::error!("Failed to refresh tray menu: {}", e);
                    }
                });
            }
            Ok(())
        }
        Err(e) => {
            log::error!("Failed to cache tray strings: {:?}", e);
            Err("Failed to cache tray strings".to_string())
        }
    }
}
