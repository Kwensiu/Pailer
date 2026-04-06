#[cfg(windows)]
use super::model::{
    is_scoop_related_path, looks_like_filesystem_path, normalize_aumid,
    normalize_executable_path, to_normcase_path, NotifyIconEntry,
};

#[cfg(windows)]
const NOTIFY_ICON_SETTINGS_KEY_PATH: &str = r"Control Panel\NotifyIconSettings";

#[cfg(windows)]
fn read_app_user_model_id(subkey: &winreg::RegKey) -> Option<String> {
    subkey
        .get_value::<String, _>("AppUserModelID")
        .ok()
        .and_then(|v| normalize_aumid(&v))
        .or_else(|| {
            subkey
                .get_value::<String, _>("AppUserModelId")
                .ok()
                .and_then(|v| normalize_aumid(&v))
        })
}

#[cfg(windows)]
pub(super) fn open_notify_icon_settings(read_only: bool) -> Result<winreg::RegKey, String> {
    use winreg::{enums::*, RegKey};

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let flags = if read_only {
        KEY_READ
    } else {
        KEY_READ | KEY_WRITE
    };

    hkcu.open_subkey_with_flags(NOTIFY_ICON_SETTINGS_KEY_PATH, flags)
        .map_err(|e| {
            format!(
                "Failed to open registry path '{}': {}",
                NOTIFY_ICON_SETTINGS_KEY_PATH, e
            )
        })
}

#[cfg(windows)]
pub(super) fn collect_scoop_notify_entries(
    parent: &winreg::RegKey,
    prefixes: &[String],
) -> (Vec<NotifyIconEntry>, Vec<String>) {
    use winreg::enums::*;

    let mut entries = Vec::new();
    let mut failed = Vec::new();

    for subkey_name in parent.enum_keys().flatten() {
        let subkey = match parent.open_subkey_with_flags(&subkey_name, KEY_READ) {
            Ok(key) => key,
            Err(e) => {
                failed.push(format!("{} (open failed: {})", subkey_name, e));
                continue;
            }
        };

        let executable_path: String = match subkey.get_value("ExecutablePath") {
            Ok(v) => v,
            Err(_) => continue,
        };
        let Some(path) = normalize_executable_path(&executable_path) else {
            continue;
        };
        if !looks_like_filesystem_path(&path) || !is_scoop_related_path(&path, prefixes) {
            continue;
        }

        entries.push(NotifyIconEntry {
            subkey: subkey_name,
            path_norm: to_normcase_path(&path),
            path,
            promoted: subkey.get_value::<u32, _>("IsPromoted").ok(),
            app_user_model_id: read_app_user_model_id(&subkey),
        });
    }

    (entries, failed)
}

#[cfg(windows)]
pub(super) fn set_is_promoted(
    parent: &winreg::RegKey,
    subkey: &str,
    value: u32,
) -> Result<(), String> {
    use winreg::enums::KEY_WRITE;

    let key = parent
        .open_subkey_with_flags(subkey, KEY_WRITE)
        .map_err(|e| format!("Failed to open keep subkey '{}': {}", subkey, e))?;
    key.set_value("IsPromoted", &value)
        .map_err(|e| format!("Failed to set IsPromoted on '{}': {}", subkey, e))
}

#[cfg(windows)]
pub(super) fn set_executable_path(
    parent: &winreg::RegKey,
    subkey: &str,
    path: &str,
) -> Result<(), String> {
    use winreg::enums::KEY_WRITE;

    let key = parent
        .open_subkey_with_flags(subkey, KEY_WRITE)
        .map_err(|e| format!("{} (open keep for path rewrite failed: {})", subkey, e))?;
    key.set_value("ExecutablePath", &path)
        .map_err(|_| format!("{} (failed to rewrite keep ExecutablePath)", subkey))
}

#[cfg(windows)]
pub(super) fn delete_notify_icon_subkey(
    parent: &winreg::RegKey,
    subkey: &str,
) -> Result<(), String> {
    parent
        .delete_subkey_all(subkey)
        .map_err(|e| format!("{} (delete duplicate failed: {})", subkey, e))
}
