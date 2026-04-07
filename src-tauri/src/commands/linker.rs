use crate::commands::powershell;
use crate::state::AppState;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use tauri::State;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

static PACKAGE_VERSION_SWITCHES_IN_PROGRESS: Lazy<Mutex<std::collections::HashSet<String>>> =
    Lazy::new(|| Mutex::new(std::collections::HashSet::new()));

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PackageVersion {
    pub version: String,
    pub is_current: bool,
    pub install_path: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct VersionedPackageInfo {
    pub name: String,
    pub current_version: String,
    pub available_versions: Vec<PackageVersion>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FastSwitchAnalysis {
    pub package_name: String,
    pub target_version: String,
    pub bucket: Option<String>,
    pub is_candidate: bool,
    pub reasons: Vec<String>,
    pub has_bin: bool,
    pub has_persist: bool,
    pub has_env: bool,
    pub has_shortcuts: bool,
    pub is_custom_bucket: bool,
}

/// Get all available versions for a package
#[tauri::command]
pub async fn get_package_versions(
    state: State<'_, AppState>,
    package_name: String,
    global: Option<bool>,
) -> Result<VersionedPackageInfo, String> {
    let scoop_path = state.scoop_path();
    let _is_global = global.unwrap_or(false);

    // Try to use cached versions first
    {
        let versions_guard = state.package_versions.lock().await;
        if let Some(cache) = versions_guard.as_ref() {
            // Check if the installed packages cache fingerprint matches
            let installed_guard = state.installed_packages.lock().await;
            if let Some(installed_cache) = installed_guard.as_ref() {
                if installed_cache.fingerprint == cache.fingerprint {
                    // Cache is still valid, use it
                    if let Some(version_dirs) = cache.versions_map.get(&package_name) {
                        // Rebuild package version info from cached data
                        return build_versioned_package_info(
                            &scoop_path,
                            &package_name,
                            version_dirs.clone(),
                        )
                        .await;
                    } else {
                    }
                } else {
                }
            }
        }
    }

    // Cache miss or invalid - perform fresh scan

    let apps_dir = scoop_path.join("apps");
    let package_dir = apps_dir.join(&package_name);

    if !package_dir.exists() {
        return Err(format!("Package '{}' is not installed", package_name));
    }

    // List all version directories
    let mut version_dirs = Vec::new();

    if let Ok(entries) = fs::read_dir(&package_dir) {
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_dir() {
                    if let Some(dir_name) = path.file_name() {
                        let dir_name_str = dir_name.to_string_lossy().to_string();

                        // Skip "current" directory (it's a symlink)
                        if dir_name_str == "current" {
                            continue;
                        }

                        // Check if this looks like a version directory
                        if is_version_directory(&path) {
                            version_dirs.push(dir_name_str);
                        }
                    }
                }
            }
        }
    }

    // Update the cache
    {
        let mut versions_guard = state.package_versions.lock().await;
        if let Ok(installed_guard) = tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current()
                .block_on(async { Ok::<_, ()>(state.installed_packages.lock().await) })
        }) {
            if let Some(installed_cache) = installed_guard.as_ref() {
                let mut map = std::collections::HashMap::new();
                map.insert(package_name.clone(), version_dirs.clone());
                *versions_guard = Some(crate::state::PackageVersionsCache {
                    fingerprint: installed_cache.fingerprint.clone(),
                    versions_map: map,
                });
            }
        }
    }

    log::info!(
        "Detected {} versions for: {}",
        version_dirs.len(),
        package_name
    );
    build_versioned_package_info(&scoop_path, &package_name, version_dirs).await
}

/// Helper function to build versioned package info from version directories
async fn build_versioned_package_info(
    scoop_path: &std::path::Path,
    package_name: &str,
    version_dirs: Vec<String>,
) -> Result<VersionedPackageInfo, String> {
    let package_dir = scoop_path.join("apps").join(package_name);

    // Get current version
    let current_link = package_dir.join("current");
    let current_version = if current_link.exists() {
        match fs::read_link(&current_link) {
            Ok(target) => {
                let resolved_target = if target.is_absolute() {
                    target.clone()
                } else {
                    package_dir.join(&target)
                };
                resolved_target
                    .file_name()
                    .map(|v| v.to_string_lossy().to_string())
                    .unwrap_or_default()
            }
            Err(_) => String::new(),
        }
    } else {
        String::new()
    };

    // Build version info
    let mut versions = Vec::new();
    for dir_name_str in version_dirs {
        let is_current = dir_name_str == current_version;
        let path = package_dir.join(&dir_name_str);
        versions.push(PackageVersion {
            version: dir_name_str,
            is_current,
            install_path: path.to_string_lossy().to_string(),
        });
    }

    // Sort versions (newest first, with current version prioritized)
    versions.sort_by(|a, b| {
        if a.is_current {
            std::cmp::Ordering::Less
        } else if b.is_current {
            std::cmp::Ordering::Greater
        } else {
            b.version.cmp(&a.version)
        }
    });

    Ok(VersionedPackageInfo {
        name: package_name.to_string(),
        current_version,
        available_versions: versions,
    })
}

/// Switch to a different version of an installed package
#[tauri::command]
pub async fn switch_package_version(
    state: State<'_, AppState>,
    package_name: String,
    target_version: String,
    global: Option<bool>,
) -> Result<String, String> {
    {
        let mut in_progress = PACKAGE_VERSION_SWITCHES_IN_PROGRESS
            .lock()
            .map_err(|_| "Failed to acquire version switch lock".to_string())?;
        if !in_progress.insert(package_name.clone()) {
            return Err(format!(
                "A version switch for package '{}' is already in progress",
                package_name
            ));
        }
    }

    let result = switch_package_version_inner(state, &package_name, &target_version, global).await;

    if let Ok(mut in_progress) = PACKAGE_VERSION_SWITCHES_IN_PROGRESS.lock() {
        in_progress.remove(&package_name);
    }

    result
}

async fn switch_package_version_inner(
    state: State<'_, AppState>,
    package_name: &str,
    target_version: &str,
    global: Option<bool>,
) -> Result<String, String> {
    let scoop_path = state.scoop_path();
    let is_global = global.unwrap_or(false);
    let apps_dir = scoop_path.join("apps");

    let package_dir = apps_dir.join(package_name);
    let target_version_dir = package_dir.join(target_version);
    // Validate that the package exists
    if !package_dir.exists() {
        return Err(format!("Package '{}' is not installed", package_name));
    }

    // Validate that the target version exists
    if !target_version_dir.exists() {
        return Err(format!(
            "Version '{}' of package '{}' is not installed",
            target_version, package_name
        ));
    }

    let current_dir = package_dir.join("current");
    let current_manifest = read_manifest_json(&current_dir).ok();
    let target_manifest = read_manifest_json(&target_version_dir)?;
    let bucket = read_install_bucket(&current_dir);

    let analysis = analyze_fast_switch_candidate(
        package_name,
        target_version,
        bucket.as_deref(),
        current_manifest.as_ref(),
        &target_manifest,
    );

    if analysis.is_candidate {
        log::info!(
            "Fast-path switching package '{}' to version '{}'",
            package_name,
            target_version
        );

        if let Err(error) = fast_switch_package_version(
            &scoop_path,
            package_name,
            &package_dir,
            &target_version_dir,
            current_manifest.as_ref(),
            &target_manifest,
            is_global,
        ) {
            log::warn!(
                "Fast-path switch failed for '{}' -> '{}': {}. Falling back to scoop reset.",
                package_name,
                target_version,
                error
            );
        } else {
            return Ok(format!(
                "Successfully switched '{}' to version '{}' via fast path",
                package_name, target_version
            ));
        }
    } else {
        log::debug!(
            "Fast-path skipped for '{}' -> '{}': {}",
            package_name,
            target_version,
            analysis.reasons.join(" | ")
        );
    }

    let reset_target = format!("{}@{}", package_name, target_version).replace('\'', "''");
    let reset_command = if is_global {
        format!("scoop reset --global '{}'", reset_target)
    } else {
        format!("scoop reset '{}'", reset_target)
    };

    powershell::run_simple_command(&reset_command)
        .await
        .map_err(|e| format!("Failed to reset package version via Scoop: {}", e))?;

    log::info!(
        "Scoop reset completed for package '{}' -> '{}'",
        package_name,
        target_version
    );

    Ok(format!(
        "Successfully switched '{}' to version '{}'",
        package_name, target_version
    ))
}

/// Check if a directory looks like a version directory
fn is_version_directory(path: &Path) -> bool {
    // Check if it contains typical scoop installation files
    let manifest_file = path.join("manifest.json");
    let install_json = path.join("install.json");

    manifest_file.exists() || install_json.exists()
}

fn read_manifest_json(dir: &Path) -> Result<Value, String> {
    let manifest_path = dir.join("manifest.json");
    let manifest_content = fs::read_to_string(&manifest_path).map_err(|e| {
        format!(
            "Failed to read manifest '{}': {}",
            manifest_path.display(),
            e
        )
    })?;
    serde_json::from_str(&manifest_content).map_err(|e| {
        format!(
            "Failed to parse manifest '{}': {}",
            manifest_path.display(),
            e
        )
    })
}

fn read_install_bucket(dir: &Path) -> Option<String> {
    let install_path = dir.join("install.json");
    let content = fs::read_to_string(install_path).ok()?;
    let json: Value = serde_json::from_str(&content).ok()?;
    json.get("bucket")
        .and_then(|v| v.as_str())
        .map(|v| v.to_string())
}

fn manifest_has_any_key(manifest: &Value, key: &str) -> bool {
    if manifest.get(key).is_some() {
        return true;
    }

    manifest
        .get("architecture")
        .and_then(|value| value.as_object())
        .map(|arches| {
            arches.values().any(|arch| {
                arch.as_object()
                    .map(|m| m.contains_key(key))
                    .unwrap_or(false)
            })
        })
        .unwrap_or(false)
}

fn current_scoop_architecture_keys() -> &'static [&'static str] {
    #[cfg(target_arch = "x86_64")]
    {
        &["64bit", "32bit"]
    }

    #[cfg(target_arch = "x86")]
    {
        &["32bit"]
    }

    #[cfg(target_arch = "aarch64")]
    {
        &["arm64", "64bit", "32bit"]
    }
}

#[derive(Debug, Clone)]
struct ShimEntry {
    name: String,
    target: String,
    args: Option<String>,
}

fn collect_shim_entries_from_bin_value(
    bin_value: &Value,
    package_name: &str,
    items: &mut Vec<ShimEntry>,
) {
    match bin_value {
        Value::String(path) => items.push(ShimEntry {
            name: Path::new(path)
                .file_stem()
                .and_then(|v| v.to_str())
                .unwrap_or(package_name)
                .to_string(),
            target: path.to_string(),
            args: None,
        }),
        Value::Array(entries) => {
            for entry in entries {
                match entry {
                    Value::String(path) => items.push(ShimEntry {
                        name: Path::new(path)
                            .file_stem()
                            .and_then(|v| v.to_str())
                            .unwrap_or(package_name)
                            .to_string(),
                        target: path.to_string(),
                        args: None,
                    }),
                    Value::Array(parts) => {
                        let Some(target) = parts.first().and_then(|v| v.as_str()) else {
                            continue;
                        };
                        let alias = parts
                            .get(1)
                            .and_then(|v| v.as_str())
                            .filter(|v| !v.is_empty())
                            .map(|v| v.to_string())
                            .unwrap_or_else(|| {
                                Path::new(target)
                                    .file_stem()
                                    .and_then(|v| v.to_str())
                                    .unwrap_or(package_name)
                                    .to_string()
                            });
                        let args = parts
                            .get(2)
                            .map(bin_args_value_to_string)
                            .filter(|v| !v.is_empty());
                        items.push(ShimEntry {
                            name: alias,
                            target: target.to_string(),
                            args,
                        });
                    }
                    _ => {}
                }
            }
        }
        Value::Object(map) => {
            for (alias, value) in map {
                match value {
                    Value::String(path) => items.push(ShimEntry {
                        name: alias.to_string(),
                        target: path.to_string(),
                        args: None,
                    }),
                    Value::Array(parts) => {
                        let Some(target) = parts.first().and_then(|v| v.as_str()) else {
                            continue;
                        };
                        let args = parts
                            .get(1)
                            .map(bin_args_value_to_string)
                            .filter(|v| !v.is_empty());
                        items.push(ShimEntry {
                            name: alias.to_string(),
                            target: target.to_string(),
                            args,
                        });
                    }
                    _ => {}
                }
            }
        }
        _ => {}
    }
}

fn bin_args_value_to_string(value: &Value) -> String {
    match value {
        Value::String(s) => s.to_string(),
        Value::Array(items) => items
            .iter()
            .filter_map(|item| item.as_str())
            .collect::<Vec<_>>()
            .join(" "),
        _ => String::new(),
    }
}

fn collect_manifest_shim_entries(manifest: &Value, package_name: &str) -> Vec<ShimEntry> {
    let mut items = Vec::new();

    if let Some(bin_value) = manifest.get("bin") {
        collect_shim_entries_from_bin_value(bin_value, package_name, &mut items);
    }

    if let Some(architecture) = manifest
        .get("architecture")
        .and_then(|value| value.as_object())
    {
        for key in current_scoop_architecture_keys() {
            let Some(arch_entry) = architecture.get(*key) else {
                continue;
            };
            if let Some(bin_value) = arch_entry.get("bin") {
                collect_shim_entries_from_bin_value(bin_value, package_name, &mut items);
            }
        }
    }

    let mut deduped = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for item in items {
        let key = item.name.to_ascii_lowercase();
        if seen.insert(key) {
            deduped.push(item);
        }
    }
    deduped
}

fn analyze_fast_switch_candidate(
    package_name: &str,
    target_version: &str,
    bucket: Option<&str>,
    current_manifest: Option<&Value>,
    target_manifest: &Value,
) -> FastSwitchAnalysis {
    let is_custom_bucket = matches!(bucket, Some("Custom"));
    let has_bin = manifest_has_any_key(target_manifest, "bin");
    let manifests: Vec<&Value> = current_manifest
        .into_iter()
        .chain(std::iter::once(target_manifest))
        .collect();
    let has_persist = manifests
        .iter()
        .any(|manifest| manifest_has_any_key(manifest, "persist"));
    let has_env = manifests.iter().any(|manifest| {
        manifest_has_any_key(manifest, "env_add_path") || manifest_has_any_key(manifest, "env_set")
    });
    let has_shortcuts = manifests
        .iter()
        .any(|manifest| manifest_has_any_key(manifest, "shortcuts"));

    let mut reasons = Vec::new();
    if is_custom_bucket {
        reasons.push("custom bucket is excluded".to_string());
    }
    if !has_bin {
        reasons.push("target manifest has no bin".to_string());
    }
    if has_persist {
        reasons.push("manifest uses persist".to_string());
    }
    if has_env {
        reasons.push("manifest uses env_add_path/env_set".to_string());
    }
    if has_shortcuts {
        reasons.push("manifest uses shortcuts".to_string());
    }

    FastSwitchAnalysis {
        package_name: package_name.to_string(),
        target_version: target_version.to_string(),
        bucket: bucket.map(|value| value.to_string()),
        is_candidate: reasons.is_empty(),
        reasons,
        has_bin,
        has_persist,
        has_env,
        has_shortcuts,
        is_custom_bucket,
    }
}

fn remove_path_if_exists(path: &Path) -> Result<(), String> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(err) => {
            return Err(format!(
                "Failed to read metadata for '{}': {}",
                path.display(),
                err
            ))
        }
    };

    if metadata.file_type().is_symlink() {
        clear_link_readonly_attribute(path)?;
        fs::remove_dir(path)
            .or_else(|_| fs::remove_file(path))
            .map_err(|e| format!("Failed to remove link '{}': {}", path.display(), e))
    } else if metadata.is_dir() {
        clear_link_readonly_attribute(path)?;
        fs::remove_dir_all(path)
            .map_err(|e| format!("Failed to remove directory '{}': {}", path.display(), e))
    } else {
        fs::remove_file(path)
            .map_err(|e| format!("Failed to remove file '{}': {}", path.display(), e))
    }
}

fn clear_link_readonly_attribute(path: &Path) -> Result<(), String> {
    let mut command = Command::new("cmd");
    command.args(["/c", "attrib", "-R", "/L", &path.to_string_lossy()]);

    #[cfg(windows)]
    command.creation_flags(0x0800_0000);

    let output = command.output().map_err(|e| {
        format!(
            "Failed to clear readonly attribute for '{}': {}",
            path.display(),
            e
        )
    })?;

    if output.status.success() {
        Ok(())
    } else {
        Err(format!(
            "Failed to clear readonly attribute for '{}': {}",
            path.display(),
            String::from_utf8_lossy(&output.stderr).trim()
        ))
    }
}

fn create_directory_junction(link: &Path, target: &Path) -> Result<(), String> {
    let mut command = Command::new("cmd");
    command.args([
        "/c",
        "mklink",
        "/J",
        &link.to_string_lossy(),
        &target.to_string_lossy(),
    ]);

    #[cfg(windows)]
    command.creation_flags(0x0800_0000);

    let output = command
        .output()
        .map_err(|e| format!("Failed to execute mklink command: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(format!(
            "Failed to create current junction: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ))
    }
}

fn update_current_junction(package_dir: &Path, target_version_dir: &Path) -> Result<(), String> {
    let current_dir = package_dir.join("current");
    remove_path_if_exists(&current_dir)?;
    create_directory_junction(&current_dir, target_version_dir)
}

fn write_shim(
    scoop_path: &Path,
    shims_dir: &Path,
    current_dir: &Path,
    entry: &ShimEntry,
) -> Result<(), String> {
    let target_path = resolve_shim_target_path(current_dir, &entry.target)?;
    fs::create_dir_all(shims_dir).map_err(|e| {
        format!(
            "Failed to create shims directory '{}': {}",
            shims_dir.display(),
            e
        )
    })?;

    let shim_file = shims_dir.join(format!("{}.shim", entry.name));
    let mut content = format!("path = \"{}\"\n", target_path.replace('\\', "\\\\"));
    if let Some(args) = &entry.args {
        content.push_str(&format!("args = {}\n", args));
    }
    fs::write(&shim_file, content)
        .map_err(|e| format!("Failed to write shim '{}': {}", shim_file.display(), e))?;

    let shim_template = resolve_shim_template_path(scoop_path)?;

    let shim_exe = shims_dir.join(format!("{}.exe", entry.name));
    fs::copy(&shim_template, &shim_exe).map_err(|e| {
        format!(
            "Failed to copy shim executable '{}': {}",
            shim_exe.display(),
            e
        )
    })?;

    Ok(())
}

fn resolve_shim_template_path(scoop_path: &Path) -> Result<PathBuf, String> {
    let shim_root = scoop_path
        .join("apps")
        .join("scoop")
        .join("current")
        .join("supporting")
        .join("shims");

    let candidates = [
        shim_root.join("kiennq").join("shim.exe"),
        shim_root.join("scoopcs").join("shim.exe"),
        shim_root.join("71").join("shim.exe"),
    ];

    candidates
        .into_iter()
        .find(|path| path.exists())
        .ok_or_else(|| {
            format!(
                "Scoop shim template not found under '{}'",
                shim_root.display()
            )
        })
}

fn resolve_shim_target_path(current_dir: &Path, target: &str) -> Result<String, String> {
    let target_path = Path::new(target);
    let resolved = if target_path.is_absolute() {
        PathBuf::from(target)
    } else {
        current_dir.join(target_path)
    };

    if resolved.is_file() {
        return Ok(resolved.to_string_lossy().to_string());
    }

    let has_ext = target_path.extension().is_some();
    if !has_ext {
        for ext in ["exe", "cmd", "bat", "ps1"] {
            let candidate = resolved.with_extension(ext);
            if candidate.is_file() {
                return Ok(candidate.to_string_lossy().to_string());
            }
        }
    }

    Err(format!(
        "Shim target '{}' could not be resolved under '{}'",
        target,
        current_dir.display()
    ))
}

fn remove_shim(shims_dir: &Path, shim_name: &str) -> Result<(), String> {
    for ext in ["shim", "exe", "cmd", "ps1", "exe.shimmed"] {
        let path = shims_dir.join(format!("{}.{}", shim_name, ext));
        if path.exists() {
            fs::remove_file(&path)
                .map_err(|e| format!("Failed to remove shim file '{}': {}", path.display(), e))?;
        }
    }
    Ok(())
}

fn refresh_package_shims(
    scoop_path: &Path,
    package_name: &str,
    current_manifest: Option<&Value>,
    target_manifest: &Value,
    is_global: bool,
) -> Result<(), String> {
    let current_dir = scoop_path.join("apps").join(package_name).join("current");
    let shims_dir = if is_global {
        scoop_path.join("global").join("shims")
    } else {
        scoop_path.join("shims")
    };

    let previous_entries = current_manifest
        .map(|manifest| collect_manifest_shim_entries(manifest, package_name))
        .unwrap_or_default();
    let next_entries = collect_manifest_shim_entries(target_manifest, package_name);

    let previous_names: std::collections::HashSet<String> = previous_entries
        .iter()
        .map(|entry| entry.name.to_ascii_lowercase())
        .collect();
    let next_names: std::collections::HashSet<String> = next_entries
        .iter()
        .map(|entry| entry.name.to_ascii_lowercase())
        .collect();

    for entry in &next_entries {
        write_shim(scoop_path, &shims_dir, &current_dir, entry)?;
    }

    for stale_name in previous_names.difference(&next_names) {
        if let Some(previous) = previous_entries
            .iter()
            .find(|entry| entry.name.eq_ignore_ascii_case(stale_name))
        {
            remove_shim(&shims_dir, &previous.name)?;
        }
    }

    Ok(())
}

fn fast_switch_package_version(
    scoop_path: &Path,
    package_name: &str,
    package_dir: &Path,
    target_version_dir: &Path,
    current_manifest: Option<&Value>,
    target_manifest: &Value,
    is_global: bool,
) -> Result<(), String> {
    update_current_junction(package_dir, target_version_dir)?;
    refresh_package_shims(
        scoop_path,
        package_name,
        current_manifest,
        target_manifest,
        is_global,
    )
}

#[tauri::command]
pub async fn analyze_package_fast_switch(
    state: State<'_, AppState>,
    package_name: String,
    target_version: String,
    global: Option<bool>,
) -> Result<FastSwitchAnalysis, String> {
    let scoop_path = state.scoop_path();
    let _is_global = global.unwrap_or(false);
    let package_dir = scoop_path.join("apps").join(&package_name);
    let target_version_dir = package_dir.join(&target_version);
    let current_dir = package_dir.join("current");

    if !package_dir.exists() {
        return Err(format!("Package '{}' is not installed", package_name));
    }

    if !target_version_dir.exists() {
        return Err(format!(
            "Version '{}' of package '{}' is not installed",
            target_version, package_name
        ));
    }

    let current_manifest = read_manifest_json(&current_dir).ok();
    let target_manifest = read_manifest_json(&target_version_dir)?;
    let bucket = read_install_bucket(&current_dir);

    Ok(analyze_fast_switch_candidate(
        &package_name,
        &target_version,
        bucket.as_deref(),
        current_manifest.as_ref(),
        &target_manifest,
    ))
}

/// Get packages that are versioned or custom installations
#[tauri::command]
pub async fn get_versioned_packages(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    global: Option<bool>,
) -> Result<Vec<String>, String> {
    let _is_global = global.unwrap_or(false);

    // Get installed packages and filter by installation type
    let installed_packages =
        crate::commands::installed::get_installed_packages_full(app, state).await?;

    let versioned_packages: Vec<String> = installed_packages
        .iter()
        .filter(|pkg| {
            matches!(
                pkg.installation_type,
                crate::models::InstallationType::Versioned
                    | crate::models::InstallationType::Custom
            )
        })
        .map(|pkg| pkg.name.clone())
        .collect();

    log::info!(
        "Found {} versioned/custom packages: {:?}",
        versioned_packages.len(),
        versioned_packages
    );
    Ok(versioned_packages)
}

/// Debug command to inspect package directory structure
#[tauri::command]
pub async fn debug_package_structure(
    state: State<'_, AppState>,
    package_name: String,
    global: Option<bool>,
) -> Result<String, String> {
    let scoop_path = state.scoop_path();
    let is_global = global.unwrap_or(false);

    let apps_dir = if is_global {
        scoop_path.join("apps")
    } else {
        scoop_path.join("apps")
    };

    let package_dir = apps_dir.join(&package_name);

    if !package_dir.exists() {
        return Err(format!("Package '{}' is not installed", package_name));
    }

    let mut debug_info = Vec::new();
    debug_info.push(format!("Package directory: {}", package_dir.display()));

    // Check current symlink
    let current_link = package_dir.join("current");
    if current_link.exists() {
        match fs::read_link(&current_link) {
            Ok(target) => {
                debug_info.push(format!("Current symlink target: {:?}", target));

                let resolved_target = if target.is_absolute() {
                    target.clone()
                } else {
                    package_dir.join(&target)
                };
                debug_info.push(format!("Resolved target: {}", resolved_target.display()));

                if let Some(version) = resolved_target.file_name() {
                    debug_info.push(format!(
                        "Detected current version: {}",
                        version.to_string_lossy()
                    ));
                }
            }
            Err(e) => debug_info.push(format!("Error reading symlink: {}", e)),
        }
    } else {
        debug_info.push("No current symlink found".to_string());
    }

    // List all directories
    debug_info.push("\nDirectory contents:".to_string());
    if let Ok(entries) = fs::read_dir(&package_dir) {
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if let Some(name) = path.file_name() {
                    let name_str = name.to_string_lossy();
                    if path.is_dir() {
                        let is_version = is_version_directory(&path);
                        debug_info
                            .push(format!("  DIR: {} (version_dir: {})", name_str, is_version));
                    } else {
                        debug_info.push(format!("  FILE: {}", name_str));
                    }
                }
            }
        }
    }

    Ok(debug_info.join("\n"))
}

/// Change the bucket of an installed package by modifying its install.json
#[tauri::command]
pub async fn change_package_bucket(
    state: State<'_, AppState>,
    package_name: String,
    new_bucket: String,
) -> Result<String, String> {
    let scoop_path = state.scoop_path();
    let apps_dir = scoop_path.join("apps");
    let package_dir = apps_dir.join(&package_name);

    if !package_dir.exists() {
        return Err(format!("Package '{}' is not installed", package_name));
    }

    // Find the current installation directory (either "current" or latest version)
    let install_dir = {
        let current_path = package_dir.join("current");
        if current_path.exists() && current_path.is_dir() {
            current_path
        } else {
            // Find the latest version directory
            let mut candidates = Vec::new();

            if let Ok(entries) = fs::read_dir(&package_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        if let Some(name) = path.file_name() {
                            // Skip "current" directory
                            if name.to_string_lossy() == "current" {
                                continue;
                            }

                            // Check if it's a version directory (has install.json or manifest.json)
                            let install_json = path.join("install.json");
                            let manifest_json = path.join("manifest.json");

                            if install_json.exists() || manifest_json.exists() {
                                if let Ok(metadata) = fs::metadata(&path) {
                                    if let Ok(modified) = metadata.modified() {
                                        candidates.push((modified, path));
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Sort by modification time and get the latest
            candidates.sort_by(|a, b| b.0.cmp(&a.0));
            candidates
                .into_iter()
                .next()
                .map(|(_, path)| path)
                .ok_or_else(|| {
                    format!(
                        "Could not find installation directory for package '{}'",
                        package_name
                    )
                })?
        }
    };

    // Read the install.json file
    let install_json_path = install_dir.join("install.json");
    if !install_json_path.exists() {
        return Err(format!(
            "install.json not found for package '{}'",
            package_name
        ));
    }

    let install_json_content = fs::read_to_string(&install_json_path)
        .map_err(|e| format!("Failed to read install.json: {}", e))?;

    // Parse the JSON
    let mut install_data: serde_json::Value = serde_json::from_str(&install_json_content)
        .map_err(|e| format!("Failed to parse install.json: {}", e))?;

    // Update the bucket field
    if let Some(obj) = install_data.as_object_mut() {
        obj.insert(
            "bucket".to_string(),
            serde_json::Value::String(new_bucket.clone()),
        );
    } else {
        return Err("install.json is not a valid JSON object".to_string());
    }

    // Write back to the file
    let updated_content = serde_json::to_string_pretty(&install_data)
        .map_err(|e| format!("Failed to serialize updated install.json: {}", e))?;

    fs::write(&install_json_path, updated_content)
        .map_err(|e| format!("Failed to write updated install.json: {}", e))?;

    Ok(format!(
        "Successfully changed bucket for '{}' to '{}'",
        package_name, new_bucket
    ))
}
