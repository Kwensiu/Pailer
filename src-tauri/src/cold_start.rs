use crate::state::AppState;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Manager, Runtime};

static COLD_START_DONE: AtomicBool = AtomicBool::new(false);

/// Performs cold start initialization, ensuring it only runs once.
pub fn run_cold_start<R: Runtime>(app: AppHandle<R>) {
    // If already done, just return
    if COLD_START_DONE.swap(true, Ordering::SeqCst) {
        log::info!("Cold start previously completed.");
        return;
    }

    tauri::async_runtime::spawn(async move {
        log::info!("Starting cold start initialization...");

        let state = app.state::<AppState>();
        log::info!("Getting AppState for cold start initialization");
        
        // Try to prefetch data, but don't block UI if it fails
        match crate::commands::installed::get_installed_packages_full(app.clone(), state).await {
            Ok(pkgs) => {
                log::info!("Prefetched {} installed packages", pkgs.len());

                // Warm the search manifest cache.
                log::info!("Warming search manifest cache...");
                if let Err(e) = crate::commands::search::warm_manifest_cache(app.clone()).await {
                    log::warn!("Failed to warm search manifest cache: {}", e);
                } else {
                    log::info!("Search manifest cache warmed successfully");
                }
            }
            Err(e) => {
                log::warn!("Failed to prefetch installed packages: {}", e);
                log::warn!("This is likely due to Scoop not being configured. UI will still load.");
            }
        }

        // UI loads immediately, no need to emit events anymore
        log::info!("Cold start initialization completed - UI ready");
    });
}

/// Returns whether the cold start sequence has completed successfully.
#[tauri::command]
pub fn is_cold_start_ready() -> bool {
    COLD_START_DONE.load(Ordering::SeqCst)
}