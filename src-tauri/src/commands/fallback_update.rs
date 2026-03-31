use serde::{Deserialize, Serialize};
use std::process::Command;
use std::str;
use base64::{Engine as _, engine::general_purpose};
use sha2::{Sha256, Digest};
use std::fs::File;
use std::io::{BufReader, Read};
use tauri::AppHandle;

// Repository constants
const REPO_OWNER: &str = "Kwensiu";
const REPO_NAME: &str = "Pailer";

/// Represents update information from GitHub API
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FallbackUpdateInfo {
    pub version: String,
    pub pub_date: String,
    pub download_url: String,
    pub signature: String,
    pub notes: String,
    pub body: Option<String>,
    pub channel: String,
}

/// Represents a GitHub release
#[derive(Deserialize, Debug)]
struct GitHubRelease {
    tag_name: String,
    published_at: String,
    body: Option<String>,
    assets: Vec<GitHubAsset>,
}

#[derive(Deserialize, Debug)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
}

/// Check for updates using GitHub API directly
/// This is used as a fallback when Tauri updater fails or doesn't find updates
#[tauri::command]
pub async fn check_for_fallback_update(_app_handle: AppHandle) -> Result<FallbackUpdateInfo, String> {
    log::info!("Starting fallback update check using GitHub API");
    
    // Get the latest release from GitHub API for stable channel
    let api_url = format!("https://api.github.com/repos/{}/{}/releases/latest", REPO_OWNER, REPO_NAME);
    
    log::info!("Checking for updates on stable channel");
    
    log::debug!("Fetching release info from: {}", api_url);
    
    // Make HTTP request to GitHub API
    let client = reqwest::Client::new();
    let response = client
        .get(&api_url)
        .header("User-Agent", "Pailer-Updater")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch release info: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("GitHub API returned status: {}", response.status()));
    }
    
    // Parse the response as a single release (stable channel)
    let release = response.json::<GitHubRelease>()
        .await
        .map_err(|e| format!("Failed to parse release: {}", e))?;
    
    // Extract version from tag (remove 'v' prefix if present)
    let version = release.tag_name.strip_prefix('v').unwrap_or(&release.tag_name).to_string();
    
    // Find the Windows installer asset
    let windows_asset = release.assets.into_iter()
        .find(|asset| asset.name.ends_with(".exe"))
        .ok_or("Windows installer not found in release assets")?;
    
    log::info!("Found update: {} from {}", version, release.published_at);
    
    // Compare versions to ensure we only return newer versions
    let current_version = env!("CARGO_PKG_VERSION");
    
    if version == current_version {
        log::info!("Remote version {} is the same as current version {}", version, current_version);
        return Err("No newer version available".to_string());
    }
    
    log::info!("Newer version found: {} (current: {})", version, current_version);
    
    // For the signature, we'll need to get it from the update.json file
    // This is a limitation of using GitHub API directly
    let signature = get_signature_for_version(&version).await?;
    
    // Create update info
    let update_info = FallbackUpdateInfo {
        version: version.clone(),
        pub_date: release.published_at,
        download_url: windows_asset.browser_download_url,
        signature,
        notes: format!("Update available for stable channel"),
        body: release.body,
        channel: "stable".to_string(),
    };
    
    Ok(update_info)
}

/// Get signature for a specific version from the update.json file
async fn get_signature_for_version(_version: &str) -> Result<String, String> {
    // Always use stable channel update.json URL
    let update_json_url = format!("https://github.com/Kwensiu/Pailer/releases/latest/download/update.json");
    
    log::debug!("Fetching signature from: {}", update_json_url);
    
    let client = reqwest::Client::new();
    let response = client
        .get(&update_json_url)
        .header("User-Agent", "Pailer-Updater")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch update.json: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Failed to fetch signature: HTTP {}", response.status()));
    }
    
    let update_data: serde_json::Value = response.json()
        .await
        .map_err(|e| format!("Failed to parse update.json: {}", e))?;
    
    // Extract signature for Windows x64 platform
    if let Some(platforms) = update_data.get("platforms") {
        if let Some(windows_platform) = platforms.get("windows-x86_64") {
            if let Some(signature) = windows_platform.get("signature") {
                if let Some(sig_str) = signature.as_str() {
                    // Validate signature format before processing
                    if sig_str.is_empty() || sig_str.len() > 128 {
                        log::warn!("Invalid signature format: length {}", sig_str.len());
                        return Err("Invalid signature format".to_string());
                    }

                    // Only allow hex characters and base64 characters
                    if !sig_str.chars().all(|c| c.is_ascii_hexdigit() || c.is_ascii_alphanumeric() || c == '+' || c == '/' || c == '=') {
                        log::warn!("Invalid signature characters detected");
                        return Err("Invalid signature characters".to_string());
                    }

                    // Try to decode as Base64 first (Tauri Action format)
                    match general_purpose::STANDARD.decode(sig_str) {
                        Ok(decoded_bytes) => {
                            // Convert decoded bytes to hex string
                            let hex_string = decoded_bytes.iter()
                                .map(|b| format!("{:02x}", b))
                                .collect::<String>();
                            log::info!("Successfully decoded signature from Base64: {}...", &hex_string[..32]); // Show first 32 chars
                            return Ok(hex_string);
                        }
                        Err(_) => {
                            // If Base64 decode fails, assume it's already a hex string
                            log::info!("Signature is not Base64, using as hex string");
                            return Ok(sig_str.to_string());
                        }
                    }
                }
            }
        }
    }
    
    log::warn!("Signature not found in update.json");
    Ok("signature-not-found".to_string())
}

/// Calculate SHA256 hash of a file
fn calculate_file_hash(file_path: &std::path::Path) -> Result<String, String> {
    let file = File::open(file_path)
        .map_err(|e| format!("Failed to open file for hashing: {}", e))?;
    
    let mut reader = BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut buffer = [0; 8192];
    
    loop {
        let bytes_read = reader.read(&mut buffer)
            .map_err(|e| format!("Failed to read file for hashing: {}", e))?;
        
        if bytes_read == 0 {
            break;
        }
        
        hasher.update(&buffer[..bytes_read]);
    }
    
    let hash = hasher.finalize();
    Ok(hash.iter().map(|b| format!("{:02x}", b)).collect())
}

/// Verify downloaded file integrity against expected signature
fn verify_download_integrity(
    installer_path: &std::path::Path, 
    expected_signature: &str
) -> Result<(), String> {
    let calculated_hash = calculate_file_hash(installer_path)?;
    
    if calculated_hash.eq_ignore_ascii_case(expected_signature) {
        log::info!("✅ File integrity verification successful");
        log::debug!("Expected: {}, Calculated: {}", expected_signature, calculated_hash);
        Ok(())
    } else {
        log::error!("❌ File integrity verification failed!");
        log::error!("Expected: {}, Calculated: {}", expected_signature, calculated_hash);
        Err("File integrity check failed - possible tampering detected".to_string())
    }
}

/// Download and install the fallback update
#[tauri::command]
pub async fn download_and_install_fallback_update(
    app_handle: AppHandle,
    update_info: FallbackUpdateInfo,
) -> Result<(), String> {
    log::info!("Starting fallback update download and installation");
    
    // Create a temporary directory for the download
    let temp_dir = std::env::temp_dir();
    let installer_path = temp_dir.join(format!("pailer_update_{}.exe", update_info.version));
    
    // Download the installer
    log::info!("Downloading installer from: {}", update_info.download_url);
    let client = reqwest::Client::new();
    let response = client
        .get(&update_info.download_url)
        .header("User-Agent", "Pailer-Updater")
        .send()
        .await
        .map_err(|e| format!("Failed to download installer: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Download failed with status: {}", response.status()));
    }
    
    let installer_bytes = response.bytes()
        .await
        .map_err(|e| format!("Failed to read installer bytes: {}", e))?;
    
    // Write installer to disk
    std::fs::write(&installer_path, &installer_bytes)
        .map_err(|e| format!("Failed to write installer: {}", e))?;
    
    log::info!("Installer downloaded to: {}", installer_path.display());
    
    // 🔐 Verify file integrity against signature from update.json
    verify_download_integrity(&installer_path, &update_info.signature)?;
    
    log::info!("✅ File integrity verified, proceeding with installation");
    
    // Execute the installer with the same arguments as in tauri.conf.json
    let args = vec!["/CURRENTUSER", "/MERGETASKS=!desktopicon,!quicklaunchicon"];
    
    log::info!("Starting installer with args: {:?}", args);
    
    let mut cmd = Command::new(&installer_path);
    cmd.args(args);
    
    use std::os::windows::process::CommandExt;
    // Create the installer process detached from parent
    cmd.creation_flags(0x08000000); // DETACHED_PROCESS
    
    let child = cmd.spawn()
        .map_err(|e| format!("Failed to start installer: {}", e))?;
    
    log::info!("Installer started with PID: {}", child.id());
    
    // Clean up temporary installer file in a background thread
    let installer_path_clone = installer_path.clone();
    std::thread::spawn(move || {
        // Wait a bit for the installer to start properly
        std::thread::sleep(std::time::Duration::from_secs(5));
        // Only remove if file still exists and is not locked
        if installer_path_clone.exists() {
            match std::fs::remove_file(&installer_path_clone) {
                Ok(_) => log::info!("Cleaned up temporary installer file"),
                Err(e) => log::warn!("Failed to clean up temporary installer file: {}", e),
            }
        }
    });
    
    // Exit the current application
    std::thread::sleep(std::time::Duration::from_secs(1));
    app_handle.exit(0);
    
    Ok(())
}

/// Get current app version
#[tauri::command]
pub async fn get_current_version() -> Result<String, String> {
    Ok(env!("CARGO_PKG_VERSION").to_string())
}