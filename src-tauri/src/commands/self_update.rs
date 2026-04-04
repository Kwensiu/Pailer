use crate::utils;
use std::process::Command;
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Runtime};
use tokio::time::{sleep, Duration};

fn collect_manifest_bin_entries(bin_value: Option<&serde_json::Value>) -> Vec<String> {
    match bin_value {
        Some(serde_json::Value::String(value)) => vec![value.to_string()],
        Some(serde_json::Value::Array(values)) => values
            .iter()
            .filter_map(|value| match value {
                serde_json::Value::String(path) => Some(path.to_string()),
                serde_json::Value::Array(parts) => parts
                    .first()
                    .and_then(|part| part.as_str())
                    .map(|path| path.to_string()),
                _ => None,
            })
            .collect(),
        _ => Vec::new(),
    }
}

fn resolve_self_restart_executable(current_dir: &PathBuf) -> Result<PathBuf, String> {
    let manifest_path = current_dir.join("manifest.json");
    if manifest_path.exists() {
        let manifest_content = fs::read_to_string(&manifest_path).map_err(|e| {
            format!(
                "Failed to read Pailer manifest for restart path resolution: {}",
                e
            )
        })?;
        let manifest_json: serde_json::Value = serde_json::from_str(&manifest_content)
            .map_err(|e| format!("Failed to parse Pailer manifest for restart path resolution: {}", e))?;

        for bin_entry in collect_manifest_bin_entries(manifest_json.get("bin")) {
            let candidate = current_dir.join(bin_entry);
            if candidate.is_file() {
                return Ok(candidate);
            }
        }
    }

    let explicit_fallback = current_dir.join("pailer.exe");
    if explicit_fallback.is_file() {
        return Ok(explicit_fallback);
    }

    let mut exe_candidates = fs::read_dir(current_dir)
        .map_err(|e| format!("Failed to scan current directory for restart executable: {}", e))?
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| {
            path.is_file()
                && path
                    .extension()
                    .and_then(|ext| ext.to_str())
                    .map(|ext| ext.eq_ignore_ascii_case("exe"))
                    .unwrap_or(false)
        })
        .collect::<Vec<_>>();
    exe_candidates.sort();

    exe_candidates.into_iter().next().ok_or_else(|| {
        format!(
            "Could not locate restart executable under current link directory: {}",
            current_dir.display()
        )
    })
}

fn resolve_pailer_current_restart_exe<R: Runtime>(app: AppHandle<R>) -> Result<PathBuf, String> {
    let scoop_root = utils::resolve_scoop_root(app)?;
    let current_dir = scoop_root.join("apps").join("pailer").join("current");
    if !current_dir.is_dir() {
        return Err(format!(
            "Pailer current directory not found: {}",
            current_dir.display()
        ));
    }

    resolve_self_restart_executable(&current_dir)
}

/// Updates Pailer via Scoop after closing the current process.
/// This command is only used when Pailer itself is installed by Scoop.
#[tauri::command]
pub async fn update_pailer_self<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
    let current_pid = std::process::id();
    log::info!("Starting Pailer self-update process (PID: {})", current_pid);

    // Verify this is a Scoop installation
    if !utils::is_scoop_installation() {
        log::warn!(
            "Self-update rejected: not a Scoop installation (PID: {})",
            current_pid
        );
        return Err("Pailer is not installed via Scoop. Self-update is only available for Scoop installations.".to_string());
    }

    let restart_exe = resolve_pailer_current_restart_exe(app.clone())?;

    // Load the detached updater batch script with PID and restart path injection.
    let script_template = include_str!("../../scripts/self_update.cmd");
    let update_script = script_template
        .replace("{PID}", &current_pid.to_string())
        .replace("{RESTART_EXE}", &restart_exe.to_string_lossy());

    log::info!("Preparing self-update script (PID: {})", current_pid);
    log::info!(
        "Resolved self-update restart executable: {}",
        restart_exe.display()
    );

    // Create a temporary updater script file
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let script_path = std::env::temp_dir().join(format!(
        "pailer_self_update_{}_{}.cmd",
        std::process::id(),
        timestamp
    ));

    if let Err(e) = std::fs::write(&script_path, update_script) {
        return Err(format!("Failed to write updater script: {}", e));
    }

    log::info!("Self-update script written to: {}", script_path.display());

    // Best effort cleanup of old temporary updater scripts to avoid buildup.
    if let Ok(entries) = std::fs::read_dir(std::env::temp_dir()) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                if file_name.starts_with("pailer_self_update_")
                    && file_name.ends_with(".cmd")
                    && path != script_path
                {
                    let _ = std::fs::remove_file(path);
                }
            }
        }
    }

    // Run updater from %TEMP% to avoid locking the Scoop install directory.
    log::info!("Starting self-update process");
    let mut command = Command::new("cmd");
    command
        .arg("/K")
        .arg(script_path.to_string_lossy().to_string())
        .current_dir(std::env::temp_dir());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NEW_PROCESS_GROUP | CREATE_NEW_CONSOLE
        command.creation_flags(0x0000_0200 | 0x0000_0010);
    }

    command
        .spawn()
        .map_err(|e| format!("Failed to spawn self-update process: {}", e))?;

    log::info!("Self-update process started successfully");

    // Exit the main app after the invoke response has a brief chance to flush to the frontend.
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        sleep(Duration::from_millis(300)).await;
        app_handle.exit(0);
    });

    Ok("Pailer self-update started in background. Pailer will now close so the updater can continue.".to_string())
}

/// Check if Pailer can be self-updated (i.e., installed via Scoop)
#[tauri::command]
pub fn can_self_update() -> bool {
    utils::is_scoop_installation()
}
