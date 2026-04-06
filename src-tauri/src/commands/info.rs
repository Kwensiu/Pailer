//! Command for fetching detailed information about a Scoop package.
use crate::models::parse_notes_field;
use crate::state::AppState;
use crate::utils;
use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::State;

/// Represents the structured information for a Scoop package, suitable for frontend display.
#[derive(Serialize, Debug, Clone, Default)]
pub struct ScoopInfo {
    /// A list of key-value pairs representing package details.
    pub details: Vec<(String, String)>,
    /// Optional installation notes provided by the package manifest.
    pub notes: Option<String>,
}

#[derive(Serialize, Debug, Clone)]
pub struct PackageRunEntry {
    pub name: String,
}

#[derive(Debug, Clone)]
struct ResolvedRunEntry {
    name: String,
    executable_path: PathBuf,
}

/// Formats a JSON key for display, capitalizing it and handling special cases.
fn format_field_key(key: &str) -> String {
    if key == "bin" {
        return "Includes".to_string();
    }
    let mut c = key.chars();
    match c.next() {
        None => String::new(),
        Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
    }
}

/// Formats a `serde_json::Value` into a human-readable string.
fn format_json_value(value: &Value) -> String {
    match value {
        Value::String(s) => s.clone(),
        Value::Array(arr) => arr
            .iter()
            .map(|v| v.to_string().trim_matches('"').to_string())
            .collect::<Vec<_>>()
            .join(", "),
        _ => value.to_string().trim_matches('"').to_string(),
    }
}

// -----------------------------------------------------------------------------
// Custom formatting helpers
// -----------------------------------------------------------------------------
/// Extracts executable names and aliases from the `bin` field.
fn format_bin_value(value: &Value) -> String {
    if let Value::Array(arr) = value {
        let names: Vec<String> = arr
            .iter()
            .filter_map(|item| match item {
                Value::String(s) => Some(s.clone()),
                Value::Array(sub) => {
                    // First element is executable path, second is alias
                    sub.get(1)
                        .or_else(|| sub.get(0))
                        .and_then(|v| v.as_str())
                        .map(String::from)
                }
                Value::Object(obj) => obj.keys().next().map(|k| k.clone()),
                _ => None,
            })
            .collect();
        names.join(", ")
    } else {
        format_json_value(value)
    }
}

/// Parses the JSON manifest content into a structured format for display.
fn parse_manifest_details(json_value: &Value) -> (Vec<(String, String)>, Option<String>) {
    let mut details = vec![];
    let notes = parse_notes_field(json_value);

    if let Some(obj) = json_value.as_object() {
        for (key, value) in obj {
            if key == "notes" {
                continue; // Skip notes as it's handled separately
            } else if key == "bin" {
                let formatted_value = format_bin_value(value);
                details.push(("Includes".to_string(), formatted_value));
            } else {
                let formatted_key = format_field_key(key);
                let formatted_value = format_json_value(value);
                details.push((formatted_key, formatted_value));
            }
        }
    }
    (details, notes)
}

/// Fetches and formats information about a specific Scoop package.
#[tauri::command]
pub fn get_package_info(
    state: State<'_, AppState>,
    package_name: String,
    bucket: Option<String>,
) -> Result<ScoopInfo, String> {
    log::info!("Fetching info for package: {}", package_name);

    let scoop_dir = state.scoop_path();

    let requested_bucket = bucket
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty() && *value != "None")
        .map(|value| value.to_string());

    let installed_bucket = get_installed_package_bucket(&scoop_dir, &package_name);

    // When the caller provides a bucket, treat it as the source of truth and avoid
    // falling back to any other bucket. This prevents cross-bucket ambiguity for
    // packages that share the same name.
    let (manifest_path, bucket_name) = if let Some(ref bucket_name) = requested_bucket {
        match utils::locate_package_manifest(&scoop_dir, &package_name, Some(bucket_name.clone())) {
            Ok(result) => result,
            Err(err) => {
                if installed_bucket.as_deref() == Some(bucket_name.as_str()) {
                    locate_installed_manifest(&scoop_dir, &package_name).ok_or(err)?
                } else {
                    return Err(err);
                }
            }
        }
    } else {
        // Use installed bucket if available, otherwise search all buckets
        if let Some(ref installed_bucket_name) = installed_bucket {
            match utils::locate_package_manifest(
                &scoop_dir,
                &package_name,
                Some(installed_bucket_name.clone()),
            ) {
                Ok(result) => result,
                // If not found in installed bucket, fall back to searching all buckets
                Err(_) => utils::locate_package_manifest(&scoop_dir, &package_name, None)?,
            }
        } else {
            // For non-installed packages, search all buckets
            utils::locate_package_manifest(&scoop_dir, &package_name, None)?
        }
    };

    let manifest_content = fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read manifest for {}: {}", package_name, e))?;

    let json_value: Value = serde_json::from_str(&manifest_content)
        .map_err(|e| format!("Failed to parse JSON for {}: {}", package_name, e))?;

    let (mut details, notes) = parse_manifest_details(&json_value);

    // Remove "Version" entry since we'll add more specific version info
    details.retain(|(key, _)| key != "Version");

    // Add bucket information - prefer the explicit request when available.
    let display_bucket = requested_bucket.unwrap_or(bucket_name);
    details.push(("Bucket".to_string(), display_bucket));

    let installed_dir = scoop_dir.join("apps").join(&package_name).join("current");
    if installed_dir.exists() {
        details.push((
            "Installed".to_string(),
            installed_dir.to_string_lossy().to_string(),
        ));

        // Read installed manifest to get actual installed version
        if let Some(installed_version) = get_installed_version(&scoop_dir, &package_name) {
            // Get latest version from bucket manifest
            if let Some(latest_version) = json_value.get("version").and_then(|v| v.as_str()) {
                details.push((
                    "Installed Version".to_string(),
                    installed_version.to_string(),
                ));
                details.push(("Latest Version".to_string(), latest_version.to_string()));
            } else {
                details.push(("Version".to_string(), installed_version.to_string()));
            }
        }
    } else {
        // For non-installed packages, show version as "Latest Version"
        if let Some(latest_version) = json_value.get("version").and_then(|v| v.as_str()) {
            details.push(("Latest Version".to_string(), latest_version.to_string()));
        }
    }

    details.sort_by(|a, b| a.0.cmp(&b.0));

    // Prepend package name to details list for consistent display order
    let mut ordered_details = vec![("Name".to_string(), package_name.clone())];
    ordered_details.append(&mut details);

    log::info!("Successfully fetched info for {}", package_name);
    Ok(ScoopInfo {
        details: ordered_details,
        notes,
    })
}

/// Gets the installed version of a package by reading its manifest file.
fn get_installed_version(scoop_dir: &std::path::Path, package_name: &str) -> Option<String> {
    let installed_manifest_path = scoop_dir
        .join("apps")
        .join(package_name)
        .join("current")
        .join("manifest.json");

    fs::read_to_string(installed_manifest_path)
        .ok()
        .and_then(|content| serde_json::from_str::<Value>(&content).ok())
        .and_then(|json| {
            json.get("version")
                .and_then(|v| v.as_str())
                .map(String::from)
        })
}

/// Gets the bucket name for an installed package from install.json
fn get_installed_package_bucket(scoop_dir: &std::path::Path, package_name: &str) -> Option<String> {
    let install_json_path = scoop_dir
        .join("apps")
        .join(package_name)
        .join("current")
        .join("install.json");

    if install_json_path.exists() {
        if let Ok(content) = std::fs::read_to_string(install_json_path) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(bucket) = json.get("bucket").and_then(|b| b.as_str()) {
                    return Some(bucket.to_string());
                }
            }
        }
    }

    None
}

fn locate_installed_manifest(
    scoop_dir: &std::path::Path,
    package_name: &str,
) -> Option<(std::path::PathBuf, String)> {
    let installed_manifest_path = scoop_dir
        .join("apps")
        .join(package_name)
        .join("current")
        .join("manifest.json");

    if !installed_manifest_path.exists() {
        return None;
    }

    let bucket_name = get_installed_package_bucket(scoop_dir, package_name)
        .map(|bucket| format!("{} (missing)", bucket))
        .unwrap_or_else(|| "Installed (Bucket missing)".to_string());

    Some((installed_manifest_path, bucket_name))
}

fn alias_from_path(path: &str, fallback: &str) -> String {
    Path::new(path)
        .file_stem()
        .and_then(|s| s.to_str())
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.to_string())
        .unwrap_or_else(|| fallback.to_string())
}

fn collect_bin_value_candidates(
    bin_value: &Value,
    package_name: &str,
    items: &mut Vec<(String, String)>,
) {
    match bin_value {
        Value::String(path) => {
            items.push((alias_from_path(path, package_name), path.to_string()));
        }
        Value::Array(values) => {
            for value in values {
                match value {
                    Value::String(path) => {
                        items.push((alias_from_path(path, package_name), path.to_string()));
                    }
                    Value::Array(parts) => {
                        let rel = parts.first().and_then(|v| v.as_str());
                        let alias = parts.get(1).and_then(|v| v.as_str());
                        if let Some(rel_path) = rel {
                            items.push((
                                alias
                                    .filter(|v| !v.trim().is_empty())
                                    .map(|v| v.to_string())
                                    .unwrap_or_else(|| alias_from_path(rel_path, package_name)),
                                rel_path.to_string(),
                            ));
                        }
                    }
                    Value::Object(map) => {
                        for (alias, value) in map {
                            if let Some(path) = value.as_str() {
                                items.push((alias.to_string(), path.to_string()));
                            } else if let Value::Array(parts) = value {
                                if let Some(path) = parts.first().and_then(|v| v.as_str()) {
                                    items.push((alias.to_string(), path.to_string()));
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }
        }
        Value::Object(map) => {
            for (alias, value) in map {
                if let Some(path) = value.as_str() {
                    items.push((alias.to_string(), path.to_string()));
                } else if let Value::Array(parts) = value {
                    if let Some(path) = parts.first().and_then(|v| v.as_str()) {
                        items.push((alias.to_string(), path.to_string()));
                    }
                }
            }
        }
        _ => {}
    }
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

fn collect_manifest_bin_candidates(
    manifest_json: &Value,
    package_name: &str,
) -> Vec<(String, String)> {
    let mut items = Vec::new();

    if let Some(bin_value) = manifest_json.get("bin") {
        collect_bin_value_candidates(bin_value, package_name, &mut items);
    }

    if let Some(architecture) = manifest_json.get("architecture").and_then(|value| value.as_object())
    {
        for key in current_scoop_architecture_keys() {
            let Some(arch_entry) = architecture.get(*key) else {
                continue;
            };
            if let Some(bin_value) = arch_entry.get("bin") {
                collect_bin_value_candidates(bin_value, package_name, &mut items);
            }
        }
    }

    items
}

fn resolve_executable_from_relative(current_dir: &Path, relative_path: &str) -> Option<PathBuf> {
    let rel = Path::new(relative_path);
    let mut candidates = vec![
        current_dir.join(rel),
        current_dir.join("bin").join(rel),
    ];

    let has_ext = rel.extension().is_some();
    if !has_ext {
        for ext in ["exe", "cmd", "bat", "ps1"] {
            candidates.push(current_dir.join(rel).with_extension(ext));
            candidates.push(current_dir.join("bin").join(rel).with_extension(ext));
        }
    }

    candidates.into_iter().find(|path| path.is_file())
}

fn resolve_package_run_entries(
    scoop_dir: &Path,
    package_name: &str,
) -> Result<Vec<ResolvedRunEntry>, String> {
    let current_dir = scoop_dir.join("apps").join(package_name).join("current");
    if !current_dir.is_dir() {
        return Err(format!(
            "Package '{}' is not installed or missing current directory",
            package_name
        ));
    }

    let manifest_path = current_dir.join("manifest.json");
    let mut resolved = Vec::new();
    let mut seen = std::collections::HashSet::new();

    if manifest_path.is_file() {
        let manifest_content = fs::read_to_string(&manifest_path)
            .map_err(|e| format!("Failed to read manifest for {}: {}", package_name, e))?;
        let manifest_json: Value = serde_json::from_str(&manifest_content)
            .map_err(|e| format!("Failed to parse manifest for {}: {}", package_name, e))?;

        for (alias, rel_path) in collect_manifest_bin_candidates(&manifest_json, package_name) {
            let alias_key = alias.to_ascii_lowercase();
            if seen.contains(&alias_key) {
                continue;
            }

            let shims_dir = scoop_dir.join("shims");
            let mut shim_candidates = ["exe", "cmd", "bat", "ps1"]
                .iter()
                .map(|ext| shims_dir.join(format!("{}.{}", alias, ext)));
            let executable_path = shim_candidates
                .find(|path| path.is_file())
                .or_else(|| resolve_executable_from_relative(&current_dir, &rel_path));

            if let Some(path) = executable_path {
                seen.insert(alias_key);
                resolved.push(ResolvedRunEntry {
                    name: alias,
                    executable_path: path,
                });
            }
        }
    }

    if resolved.is_empty() {
        let mut fallback_files: Vec<PathBuf> = Vec::new();
        for dir in [current_dir.clone(), current_dir.join("bin")] {
            if let Ok(entries) = fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if !path.is_file() {
                        continue;
                    }
                    let Some(ext) = path.extension().and_then(|e| e.to_str()) else {
                        continue;
                    };
                    if ["exe", "cmd", "bat", "ps1"]
                        .iter()
                        .any(|candidate| ext.eq_ignore_ascii_case(candidate))
                    {
                        fallback_files.push(path);
                    }
                }
            }
        }
        fallback_files.sort();

        for file in fallback_files {
            let Some(stem) = file.file_stem().and_then(|s| s.to_str()) else {
                continue;
            };
            let key = stem.to_ascii_lowercase();
            if seen.contains(&key) {
                continue;
            }
            seen.insert(key);
            resolved.push(ResolvedRunEntry {
                name: stem.to_string(),
                executable_path: file,
            });
        }
    }

    resolved.sort_by(|a, b| {
        let a_default = a.name.eq_ignore_ascii_case(package_name);
        let b_default = b.name.eq_ignore_ascii_case(package_name);
        b_default.cmp(&a_default).then_with(|| a.name.cmp(&b.name))
    });

    Ok(resolved)
}

fn launch_executable(path: &Path) -> Result<(), String> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    let parent_dir = path
        .parent()
        .ok_or_else(|| format!("Failed to resolve parent directory for {}", path.display()))?;

    let spawn_result = if ext == "ps1" {
        let ps_exe = crate::commands::powershell::resolve_powershell_exe();
        Command::new(ps_exe)
            .arg("-NoProfile")
            .arg("-ExecutionPolicy")
            .arg("Bypass")
            .arg("-File")
            .arg(path)
            .current_dir(parent_dir)
            .spawn()
    } else if ext == "cmd" || ext == "bat" {
        Command::new("cmd")
            .arg("/C")
            .arg(path)
            .current_dir(parent_dir)
            .spawn()
    } else {
        Command::new(path).current_dir(parent_dir).spawn()
    };

    spawn_result
        .map(|_| ())
        .map_err(|e| format!("Failed to launch executable '{}': {}", path.display(), e))
}

#[tauri::command]
pub fn get_package_run_entries(
    state: State<'_, AppState>,
    package_name: String,
) -> Result<Vec<PackageRunEntry>, String> {
    let entries = resolve_package_run_entries(&state.scoop_path(), &package_name)?;
    Ok(entries
        .into_iter()
        .map(|entry| PackageRunEntry { name: entry.name })
        .collect())
}

#[tauri::command]
pub fn run_package_entry(
    state: State<'_, AppState>,
    package_name: String,
    entry_name: Option<String>,
) -> Result<String, String> {
    let entries = resolve_package_run_entries(&state.scoop_path(), &package_name)?;
    if entries.is_empty() {
        return Err(format!("No runnable entries found for '{}'", package_name));
    }

    let selected = if let Some(requested_name) = entry_name {
        entries
            .into_iter()
            .find(|entry| entry.name.eq_ignore_ascii_case(&requested_name))
            .ok_or_else(|| {
                format!(
                    "Runnable entry '{}' not found for '{}'",
                    requested_name, package_name
                )
            })?
    } else {
        entries[0].clone()
    };

    launch_executable(&selected.executable_path)?;
    Ok(format!("Launched {}", selected.name))
}
