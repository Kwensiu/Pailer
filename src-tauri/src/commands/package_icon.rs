use crate::state::LnkSourceIndexCache;
use crate::state::AppState;
use crate::utils::get_scoop_app_shortcuts_with_path;
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Manager, Runtime, State};

const PACKAGE_ICON_CACHE_VERSION: u32 = 4;

#[derive(Clone)]
pub struct ResolvedPackageIconSource {
    shortcut_path: PathBuf,
    icon_source_path: PathBuf,
    icon_index: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct PackageIconCacheMeta {
    #[serde(default = "default_package_icon_cache_version")]
    cache_version: u32,
    shortcut_path: String,
    shortcut_modified_ms: u128,
    icon_source_path: String,
    icon_source_modified_ms: u128,
    icon_index: i32,
}

fn default_package_icon_cache_version() -> u32 {
    PACKAGE_ICON_CACHE_VERSION
}

fn should_use_disk_icon_cache() -> bool {
    !cfg!(debug_assertions)
}

fn get_package_icon_cache_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?
        .join("cache")
        .join("package-icons");

    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create package icon cache dir {}: {}", dir.display(), e))?;

    Ok(dir)
}

fn normalize_cache_key(package_name: &str) -> String {
    package_name
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' || ch == '.' {
                ch
            } else {
                '_'
            }
        })
        .collect::<String>()
        .to_lowercase()
}

fn get_modified_ms(path: &Path) -> u128 {
    fs::metadata(path)
        .and_then(|meta| meta.modified())
        .ok()
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

fn infer_package_name_from_target_path(scoop_path: &Path, target_path: &Path) -> Option<String> {
    let apps_root = scoop_path.join("apps");
    let apps_root_normalized = apps_root.to_string_lossy().replace('/', "\\").to_lowercase();
    let target_normalized = target_path
        .to_string_lossy()
        .replace('/', "\\")
        .to_lowercase();
    let prefix = format!("{}\\", apps_root_normalized.trim_end_matches('\\'));

    let remainder = target_normalized.strip_prefix(&prefix)?;
    let package_name = remainder.split('\\').next()?.trim();
    if package_name.is_empty() {
        None
    } else {
        Some(package_name.to_string())
    }
}

fn parse_icon_location(raw_icon_location: Option<&str>, target_path: &Path) -> (PathBuf, i32) {
    let raw = raw_icon_location.unwrap_or("").trim();
    if raw.is_empty() {
        return (target_path.to_path_buf(), 0);
    }

    if let Some((path_part, index_part)) = raw.rsplit_once(',') {
        if let Ok(icon_index) = index_part.trim().parse::<i32>() {
            let clean_path = path_part.trim().trim_matches('"');
            if clean_path.is_empty() {
                return (target_path.to_path_buf(), icon_index);
            }
            return (PathBuf::from(clean_path), icon_index);
        }
    }

    let clean_path = raw.trim_matches('"');
    if clean_path.is_empty() {
        (target_path.to_path_buf(), 0)
    } else {
        (PathBuf::from(clean_path), 0)
    }
}

fn expand_windows_env_vars(input: &str) -> Cow<'_, str> {
    let mut current = input;
    let mut output = String::new();
    let mut changed = false;

    while let Some(start) = current.find('%') {
        let after_start = &current[start + 1..];
        let Some(end_offset) = after_start.find('%') else {
            break;
        };
        let end = start + 1 + end_offset;
        let var_name = &current[start + 1..end];
        output.push_str(&current[..start]);

        if !var_name.is_empty() {
            if let Ok(value) = std::env::var(var_name) {
                output.push_str(&value);
                changed = true;
            } else {
                output.push_str(&current[start..=end]);
            }
        } else {
            output.push_str("%%");
        }

        current = &current[end + 1..];
    }

    if !changed {
        Cow::Borrowed(input)
    } else {
        output.push_str(current);
        Cow::Owned(output)
    }
}

fn resolve_icon_source_path(raw_icon_source_path: PathBuf, shortcut_path: &Path, target_path: &Path) -> PathBuf {
    if raw_icon_source_path.as_os_str().is_empty() {
        return target_path.to_path_buf();
    }

    let expanded = expand_windows_env_vars(&raw_icon_source_path.to_string_lossy()).into_owned();
    let expanded_path = PathBuf::from(expanded);
    if expanded_path.is_absolute() {
        return expanded_path;
    }

    if let Some(shortcut_dir) = shortcut_path.parent() {
        return shortcut_dir.join(expanded_path);
    }

    expanded_path
}

fn compute_lnk_source_index_cache_key(shortcuts: &[crate::utils::ScoopAppShortcut]) -> String {
    let mut entries = shortcuts
        .iter()
        .map(|shortcut| {
            format!(
                "{}|{}|{}|{}",
                shortcut.shortcut_path.to_string_lossy(),
                get_modified_ms(&shortcut.shortcut_path),
                shortcut.target_path,
                shortcut.icon_path.as_deref().unwrap_or("")
            )
        })
        .collect::<Vec<_>>();
    entries.sort();
    entries.join("\n")
}

async fn build_lnk_source_index(
    state: &AppState,
    scoop_path: &Path,
) -> Result<HashMap<String, ResolvedPackageIconSource>, String> {
    let shortcuts = get_scoop_app_shortcuts_with_path(scoop_path)?;
    let cache_key = compute_lnk_source_index_cache_key(&shortcuts);

    // Check cache with read lock
    {
        let cache = state.lnk_source_index.read().await;
        if let Some(entry) = cache.as_ref() {
            if entry.cache_key == cache_key {
                return Ok(entry.index.clone());
            }
        }
    } // Read lock released

    // Build with write lock (other requests will block and wait)
    let mut cache = state.lnk_source_index.write().await;

    // Double check (another request might have just built it)
    if let Some(entry) = cache.as_ref() {
        if entry.cache_key == cache_key {
            return Ok(entry.index.clone());
        }
    }

    let mut index = HashMap::new();

    for shortcut in shortcuts {
        let target_path = PathBuf::from(&shortcut.target_path);
        if !target_path.exists() {
            continue;
        }

        let Some(package_name) = infer_package_name_from_target_path(scoop_path, &target_path) else {
            continue;
        };

        let (icon_source_path, icon_index) =
            parse_icon_location(shortcut.icon_path.as_deref(), &target_path);
        let icon_source_path =
            resolve_icon_source_path(icon_source_path, &shortcut.shortcut_path, &target_path);

        if !icon_source_path.exists() {
            continue;
        }

        // Store with lowercase key
        let lookup_key = package_name.to_lowercase();
        index
            .entry(lookup_key)
            .or_insert_with(|| ResolvedPackageIconSource {
                shortcut_path: shortcut.shortcut_path,
                icon_source_path,
                icon_index,
            });
    }

    *cache = Some(LnkSourceIndexCache {
        cache_key,
        index: index.clone(),
    });

    Ok(index)
}

fn resolve_from_manifest_shortcuts(
    scoop_path: &Path,
    package_name: &str,
) -> Option<ResolvedPackageIconSource> {
    let manifest_path = scoop_path
        .join("apps")
        .join(package_name)
        .join("current")
        .join("manifest.json");

    if !manifest_path.exists() {
        return None;
    }

    let content = fs::read_to_string(&manifest_path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;

    let shortcuts = json.get("shortcuts")?.as_array()?;

    for shortcut_entry in shortcuts {
        let exe_path = match shortcut_entry {
            serde_json::Value::Array(arr) => arr.first().and_then(|value| value.as_str()),
            serde_json::Value::String(s) => Some(s.as_str()),
            _ => None,
        };

        let Some(exe_path) = exe_path else {
            continue;
        };

        let full_exe_path = scoop_path
            .join("apps")
            .join(package_name)
            .join("current")
            .join(exe_path);

        if full_exe_path.exists() {
            return Some(ResolvedPackageIconSource {
                shortcut_path: manifest_path.clone(),
                icon_source_path: full_exe_path,
                icon_index: 0,
            });
        }
    }

    None
}

fn resolve_from_manifest_bin(
    scoop_path: &Path,
    package_name: &str,
) -> Option<ResolvedPackageIconSource> {
    let manifest_path = scoop_path
        .join("apps")
        .join(package_name)
        .join("current")
        .join("manifest.json");

    if !manifest_path.exists() {
        return None;
    }

    let content = fs::read_to_string(&manifest_path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;
    let current_dir = scoop_path.join("apps").join(package_name).join("current");

    let bin_entries = match json.get("bin") {
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
            .collect::<Vec<_>>(),
        _ => Vec::new(),
    };

    for bin_entry in bin_entries {
        let bin_path = current_dir.join(&bin_entry);
        if bin_path.exists() {
            return Some(ResolvedPackageIconSource {
                shortcut_path: manifest_path.clone(),
                icon_source_path: bin_path,
                icon_index: 0,
            });
        }
    }

    None
}

fn find_first_existing_file(paths: impl IntoIterator<Item = PathBuf>) -> Option<PathBuf> {
    paths.into_iter().find(|path| path.exists() && path.is_file())
}

fn collect_manifest_string_or_array(value: Option<&serde_json::Value>) -> Vec<String> {
    match value {
        Some(serde_json::Value::String(item)) => vec![item.to_string()],
        Some(serde_json::Value::Array(items)) => items
            .iter()
            .filter_map(|item| item.as_str().map(|value| value.to_string()))
            .collect(),
        _ => Vec::new(),
    }
}

fn find_first_icon_like_file(dir: &Path) -> Option<PathBuf> {
    let entries = fs::read_dir(dir).ok()?;
    let mut ico_candidates = Vec::new();
    let mut exe_candidates = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let Some(extension) = path.extension().and_then(|ext| ext.to_str()) else {
            continue;
        };

        if extension.eq_ignore_ascii_case("ico") {
            ico_candidates.push(path);
            continue;
        }

        if extension.eq_ignore_ascii_case("exe") {
            exe_candidates.push(path);
        }
    }

    ico_candidates.sort();
    exe_candidates.sort();
    ico_candidates.into_iter().next().or_else(|| exe_candidates.into_iter().next())
}

fn resolve_from_manifest_paths(
    scoop_path: &Path,
    package_name: &str,
) -> Option<ResolvedPackageIconSource> {
    let manifest_path = scoop_path
        .join("apps")
        .join(package_name)
        .join("current")
        .join("manifest.json");

    if !manifest_path.exists() {
        return None;
    }

    let content = fs::read_to_string(&manifest_path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;
    let current_dir = scoop_path.join("apps").join(package_name).join("current");

    if let Some(icon_file) = find_first_existing_file([
        current_dir.join(format!("{}.ico", package_name)),
        current_dir.join(format!("{}.exe", package_name)),
    ]) {
        return Some(ResolvedPackageIconSource {
            shortcut_path: manifest_path.clone(),
            icon_source_path: icon_file,
            icon_index: 0,
        });
    }

    let env_dirs = collect_manifest_string_or_array(json.get("env_add_path"));
    for dir in env_dirs {
        let resolved_dir = current_dir.join(dir);
        if let Some(icon_file) = find_first_icon_like_file(&resolved_dir) {
            return Some(ResolvedPackageIconSource {
                shortcut_path: manifest_path.clone(),
                icon_source_path: icon_file,
                icon_index: 0,
            });
        }
    }

    for fallback_dir in [current_dir.join("bin"), current_dir.clone()] {
        if let Some(icon_file) = find_first_icon_like_file(&fallback_dir) {
            return Some(ResolvedPackageIconSource {
                shortcut_path: manifest_path.clone(),
                icon_source_path: icon_file,
                icon_index: 0,
            });
        }
    }

    None
}

fn resolve_from_lnk(_scoop_path: &Path, lnk_index: &HashMap<String, ResolvedPackageIconSource>, package_name: &str) -> Option<ResolvedPackageIconSource> {
    lnk_index.get(package_name).cloned()
}

fn resolve_package_name_exe_fallback(
    scoop_path: &Path,
    package_name: &str,
) -> Option<ResolvedPackageIconSource> {
    let package_exe_path = scoop_path
        .join("apps")
        .join(package_name)
        .join("current")
        .join(format!("{}.exe", package_name));

    if !package_exe_path.exists() {
        return None;
    }

    Some(ResolvedPackageIconSource {
        shortcut_path: package_exe_path.clone(),
        icon_source_path: package_exe_path,
        icon_index: 0,
    })
}

fn resolve_package_icon_source(
    scoop_path: &Path,
    lnk_index: &HashMap<String, ResolvedPackageIconSource>,
    package_name: &str,
) -> Option<ResolvedPackageIconSource> {
    let lookup_key = package_name.to_lowercase();
    resolve_from_manifest_shortcuts(scoop_path, &lookup_key)
        .or_else(|| resolve_from_lnk(scoop_path, lnk_index, &lookup_key))
        .or_else(|| resolve_from_manifest_bin(scoop_path, &lookup_key))
        .or_else(|| resolve_from_manifest_paths(scoop_path, &lookup_key))
        .or_else(|| resolve_package_name_exe_fallback(scoop_path, &lookup_key))
}

fn build_cache_meta(source: &ResolvedPackageIconSource) -> PackageIconCacheMeta {
    PackageIconCacheMeta {
        cache_version: PACKAGE_ICON_CACHE_VERSION,
        shortcut_path: source.shortcut_path.to_string_lossy().to_string(),
        shortcut_modified_ms: get_modified_ms(&source.shortcut_path),
        icon_source_path: source.icon_source_path.to_string_lossy().to_string(),
        icon_source_modified_ms: get_modified_ms(&source.icon_source_path),
        icon_index: source.icon_index,
    }
}

fn read_cached_icon_data_url(
    cache_dir: &Path,
    cache_key: &str,
    expected_meta: &PackageIconCacheMeta,
) -> Result<Option<String>, String> {
    let meta_path = cache_dir.join(format!("{}.json", cache_key));
    let png_path = cache_dir.join(format!("{}.png", cache_key));

    if !meta_path.exists() || !png_path.exists() {
        return Ok(None);
    }

    let raw_meta = fs::read_to_string(&meta_path)
        .map_err(|e| format!("Failed to read icon cache metadata {}: {}", meta_path.display(), e))?;
    let cached_meta: PackageIconCacheMeta = match serde_json::from_str(&raw_meta) {
        Ok(meta) => meta,
        Err(error) => {
            log::debug!(
                "Ignoring invalid icon cache metadata {}: {}",
                meta_path.display(),
                error
            );
            return Ok(None);
        }
    };

    if &cached_meta != expected_meta {
        return Ok(None);
    }

    let png_bytes = match fs::read(&png_path) {
        Ok(bytes) => bytes,
        Err(error) => {
            log::debug!(
                "Ignoring unreadable cached icon {}: {}",
                png_path.display(),
                error
            );
            return Ok(None);
        }
    };
    Ok(Some(format!(
        "data:image/png;base64,{}",
        BASE64_STANDARD.encode(png_bytes)
    )))
}

fn write_cached_icon(
    cache_dir: &Path,
    cache_key: &str,
    meta: &PackageIconCacheMeta,
    png_bytes: &[u8],
) -> Result<(), String> {
    let meta_path = cache_dir.join(format!("{}.json", cache_key));
    let png_path = cache_dir.join(format!("{}.png", cache_key));
    let meta_json = serde_json::to_string(meta)
        .map_err(|e| format!("Failed to serialize icon cache metadata: {}", e))?;

    fs::write(&png_path, png_bytes)
        .map_err(|e| format!("Failed to write cached icon {}: {}", png_path.display(), e))?;
    fs::write(&meta_path, meta_json)
        .map_err(|e| format!("Failed to write icon cache metadata {}: {}", meta_path.display(), e))?;

    Ok(())
}

fn encode_png_rgba(rgba: &[u8], width: u32, height: u32) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    let mut encoder = png::Encoder::new(&mut out, width, height);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    let mut writer = encoder
        .write_header()
        .map_err(|e| format!("Failed to initialize PNG encoder: {}", e))?;
    writer
        .write_image_data(rgba)
        .map_err(|e| format!("Failed to encode PNG data: {}", e))?;
    drop(writer);
    Ok(out)
}

#[cfg(windows)]
fn render_hicon_to_png_bytes(icon_handle: windows_sys::Win32::UI::WindowsAndMessaging::HICON, size: i32) -> Result<Vec<u8>, String> {
    use std::mem::{size_of, zeroed};
    use std::ptr::null_mut;
    use windows_sys::Win32::Graphics::Gdi::{
        CreateCompatibleDC, CreateDIBSection, DeleteDC, DeleteObject, GetDC, ReleaseDC,
        SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{DrawIconEx, DI_NORMAL};

    let screen_dc = unsafe { GetDC(null_mut()) };
    if screen_dc.is_null() {
        return Err("Failed to acquire screen device context".to_string());
    }

    let memory_dc = unsafe { CreateCompatibleDC(screen_dc) };
    if memory_dc.is_null() {
        unsafe {
            ReleaseDC(null_mut(), screen_dc);
        }
        return Err("Failed to create memory device context".to_string());
    }

    let mut bitmap_info: BITMAPINFO = unsafe { zeroed() };
    bitmap_info.bmiHeader = BITMAPINFOHEADER {
        biSize: size_of::<BITMAPINFOHEADER>() as u32,
        biWidth: size,
        biHeight: -size,
        biPlanes: 1,
        biBitCount: 32,
        biCompression: BI_RGB,
        biSizeImage: 0,
        biXPelsPerMeter: 0,
        biYPelsPerMeter: 0,
        biClrUsed: 0,
        biClrImportant: 0,
    };

    let mut bits_ptr = null_mut();
    let dib_bitmap = unsafe {
        CreateDIBSection(
            memory_dc,
            &bitmap_info,
            DIB_RGB_COLORS,
            &mut bits_ptr,
            null_mut(),
            0,
        )
    };

    if dib_bitmap.is_null() || bits_ptr.is_null() {
        unsafe {
            DeleteDC(memory_dc);
            ReleaseDC(null_mut(), screen_dc);
        }
        return Err("Failed to create DIB section for icon rendering".to_string());
    }

    let pixel_len = (size * size * 4) as usize;
    unsafe {
        std::ptr::write_bytes(bits_ptr, 0, pixel_len);
    }

    let previous_object = unsafe { SelectObject(memory_dc, dib_bitmap as _) };
    let draw_result = unsafe { DrawIconEx(memory_dc, 0, 0, icon_handle, size, size, 0, null_mut(), DI_NORMAL) };
    if draw_result == 0 {
        unsafe {
            SelectObject(memory_dc, previous_object);
            DeleteObject(dib_bitmap as _);
            DeleteDC(memory_dc);
            ReleaseDC(null_mut(), screen_dc);
        }
        return Err("Failed to render icon handle".to_string());
    }

    let bgra = unsafe { std::slice::from_raw_parts(bits_ptr as *const u8, pixel_len) };
    let mut rgba = Vec::with_capacity(pixel_len);
    let mut has_visible_rgb = false;
    let mut has_non_zero_alpha = false;

    for pixel in bgra.chunks_exact(4) {
        if pixel[0] != 0 || pixel[1] != 0 || pixel[2] != 0 {
            has_visible_rgb = true;
        }
        if pixel[3] != 0 {
            has_non_zero_alpha = true;
        }
    }

    for pixel in bgra.chunks_exact(4) {
        let blue = pixel[0] as u32;
        let green = pixel[1] as u32;
        let red = pixel[2] as u32;
        let alpha = if !has_non_zero_alpha && has_visible_rgb && (blue != 0 || green != 0 || red != 0) {
            255
        } else {
            pixel[3] as u32
        };

        let (red, green, blue) = if alpha == 0 {
            (0, 0, 0)
        } else if alpha >= 255 {
            (red, green, blue)
        } else {
            (
                ((red * 255 + alpha / 2) / alpha).min(255),
                ((green * 255 + alpha / 2) / alpha).min(255),
                ((blue * 255 + alpha / 2) / alpha).min(255),
            )
        };

        rgba.extend_from_slice(&[red as u8, green as u8, blue as u8, alpha as u8]);
    }

    unsafe {
        SelectObject(memory_dc, previous_object);
        DeleteObject(dib_bitmap as _);
        DeleteDC(memory_dc);
        ReleaseDC(null_mut(), screen_dc);
    }

    if !rgba.chunks_exact(4).any(|pixel| pixel[3] != 0) {
        return Err("Rendered icon is fully transparent".to_string());
    }

    encode_png_rgba(&rgba, size as u32, size as u32)
}

#[cfg(windows)]
fn extract_icon_png_bytes(icon_source_path: &Path, icon_index: i32, size: i32) -> Result<Vec<u8>, String> {
    use std::os::windows::ffi::OsStrExt;
    use std::ptr::null_mut;
    use windows_sys::Win32::UI::Shell::{ExtractIconExW, SHGetFileInfoW, SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON, SHGFI_SMALLICON};
    use windows_sys::Win32::UI::WindowsAndMessaging::{DestroyIcon, HICON};

    let wide_path: Vec<u16> = icon_source_path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let mut extracted_icon: HICON = null_mut();
    let extracted_count = unsafe {
        ExtractIconExW(
            wide_path.as_ptr(),
            icon_index,
            &mut extracted_icon,
            null_mut(),
            1,
        )
    };

    let icon_handle = if extracted_count > 0 && !extracted_icon.is_null() {
        extracted_icon
    } else {
        let mut file_info = SHFILEINFOW {
            hIcon: null_mut(),
            iIcon: 0,
            dwAttributes: 0,
            szDisplayName: [0; 260],
            szTypeName: [0; 80],
        };
        let flags = SHGFI_ICON | if size <= 16 { SHGFI_SMALLICON } else { SHGFI_LARGEICON };
        unsafe {
            SHGetFileInfoW(
                wide_path.as_ptr(),
                0,
                &mut file_info,
                std::mem::size_of::<SHFILEINFOW>() as u32,
                flags,
            );
        }
        if file_info.hIcon.is_null() {
            return Err(format!(
                "Failed to extract icon from {} with index {}",
                icon_source_path.display(),
                icon_index
            ));
        }
        file_info.hIcon
    };

    let render_result = render_hicon_to_png_bytes(icon_handle, size);

    unsafe {
        DestroyIcon(icon_handle);
    }

    render_result
}

#[cfg(not(windows))]
fn extract_icon_png_bytes(_icon_source_path: &Path, _icon_index: i32, _size: i32) -> Result<Vec<u8>, String> {
    Err("Package icon extraction is only supported on Windows".to_string())
}

fn get_or_create_package_icon_data_url(
    cache_dir: &Path,
    package_name: &str,
    source: &ResolvedPackageIconSource,
) -> Result<Option<String>, String> {
    let cache_key = normalize_cache_key(package_name);
    let expected_meta = build_cache_meta(source);

    if should_use_disk_icon_cache() {
        if let Some(cached_data_url) = read_cached_icon_data_url(cache_dir, &cache_key, &expected_meta)? {
            return Ok(Some(cached_data_url));
        }
    }

    let png_bytes = extract_icon_png_bytes(&source.icon_source_path, source.icon_index, 32)?;

    // Write to cache, but return icon even if caching fails
    if should_use_disk_icon_cache() {
        if let Err(e) = write_cached_icon(cache_dir, &cache_key, &expected_meta, &png_bytes) {
            log::warn!("Failed to cache icon for {}: {}", package_name, e);
        }
    }

    Ok(Some(format!(
        "data:image/png;base64,{}",
        BASE64_STANDARD.encode(png_bytes)
    )))
}

#[tauri::command]
pub async fn get_installed_package_icons<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, AppState>,
    package_names: Vec<String>,
) -> Result<HashMap<String, String>, String> {
    let cache_dir = get_package_icon_cache_dir(&app)?;
    let scoop_path = state.scoop_path();
    let lnk_index = build_lnk_source_index(&state, &scoop_path).await?;
    let mut result = HashMap::new();

    for package_name in package_names {
        let lookup_name = package_name.to_lowercase();
        let Some(source) = resolve_package_icon_source(&scoop_path, &lnk_index, &lookup_name) else {
            continue;
        };

        match get_or_create_package_icon_data_url(&cache_dir, &lookup_name, &source) {
            Ok(Some(data_url)) => {
                result.insert(package_name, data_url);
            }
            Ok(None) => {}
            Err(error) => {
                log::debug!("Failed to resolve icon for package '{}': {}", lookup_name, error);
            }
        }
    }

    Ok(result)
}
