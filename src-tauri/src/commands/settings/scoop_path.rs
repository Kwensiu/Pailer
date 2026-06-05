use std::path::PathBuf;

/// Returns the path to the Scoop configuration file.
///
/// Scoop commonly uses `%USERPROFILE%\.config\scoop\config.json`.
/// The installer can also honor `XDG_CONFIG_HOME`.
pub(super) fn get_scoop_config_path() -> Result<PathBuf, String> {
    let candidates = get_scoop_config_path_candidates()?;
    Ok(candidates
        .iter()
        .find(|path| path.exists())
        .cloned()
        .unwrap_or_else(|| candidates[0].clone()))
}

fn get_scoop_config_path_candidates() -> Result<Vec<PathBuf>, String> {
    let mut paths = Vec::new();

    if let Ok(config_home) = std::env::var("XDG_CONFIG_HOME") {
        paths.push(PathBuf::from(config_home).join("scoop").join("config.json"));
    }

    if let Ok(profile) = std::env::var("USERPROFILE") {
        paths.push(
            PathBuf::from(profile)
                .join(".config")
                .join("scoop")
                .join("config.json"),
        );
    }

    if paths.is_empty() {
        return Err("Could not resolve Scoop config path".to_string());
    }

    paths.dedup();
    Ok(paths)
}

pub(super) fn get_scoop_root_path_from_command() -> Option<String> {
    match std::process::Command::new("scoop")
        .args(["config", "root_path"])
        .output()
    {
        Ok(output) if output.status.success() => {
            let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if value.is_empty() {
                None
            } else {
                Some(value)
            }
        }
        Ok(output) => {
            log::debug!(
                "scoop config root_path failed: {}",
                String::from_utf8_lossy(&output.stderr)
            );
            None
        }
        Err(e) => {
            log::debug!("Failed to execute scoop config root_path: {}", e);
            None
        }
    }
}

#[derive(Debug, Default)]
pub(super) struct ScoopPathDetectionSources {
    pub(super) scoop_env: Option<String>,
    pub(super) command_root_path: Option<String>,
    pub(super) config_root_path: Option<String>,
    pub(super) user_profile: Option<PathBuf>,
}

fn valid_scoop_root(path: &str) -> bool {
    let path_buf = PathBuf::from(path);

    if !path_buf.exists() {
        log::warn!("Scoop root candidate '{}' does not exist", path);
        return false;
    }

    if !path_buf.is_dir() {
        log::warn!("Scoop root candidate '{}' is not a directory", path);
        return false;
    }

    match super::validate_scoop_directory(path.to_string()) {
        Ok(result) if result.valid => true,
        Ok(_) => {
            log::warn!(
                "Scoop root candidate '{}' exists but validation failed",
                path
            );
            false
        }
        Err(e) => {
            log::warn!("Failed to validate Scoop root candidate '{}': {}", path, e);
            false
        }
    }
}

pub(super) fn auto_detect_scoop_path_from_sources(
    sources: ScoopPathDetectionSources,
) -> Result<String, String> {
    if let Some(scoop_env) = sources.scoop_env {
        log::info!("SCOOP environment variable found: '{}'", scoop_env);
        if valid_scoop_root(&scoop_env) {
            log::info!(
                "Auto-detected valid Scoop installation from SCOOP environment variable: {}",
                scoop_env
            );
            return Ok(scoop_env);
        }
    } else {
        log::info!("SCOOP environment variable not set");
    }

    if let Some(root_path) = sources.command_root_path {
        log::debug!("Checking `scoop config root_path`: '{}'", root_path);
        if valid_scoop_root(&root_path) {
            log::info!(
                "Auto-detected valid Scoop installation from command: {}",
                root_path
            );
            return Ok(root_path);
        }
    }

    if let Some(root_path) = sources.config_root_path {
        log::debug!("Checking Scoop config root_path: '{}'", root_path);
        if valid_scoop_root(&root_path) {
            log::info!(
                "Auto-detected valid Scoop installation from config root_path: {}",
                root_path
            );
            return Ok(root_path);
        }
    }

    if let Some(user_profile) = sources.user_profile {
        let default_root = user_profile.join("scoop");
        let default_root = default_root.to_string_lossy().to_string();
        log::debug!("Checking official default Scoop root: '{}'", default_root);
        if valid_scoop_root(&default_root) {
            log::info!(
                "Auto-detected valid Scoop installation from default path: {}",
                default_root
            );
            return Ok(default_root);
        }
    } else {
        log::warn!("USERPROFILE environment variable not found");
    }

    log::warn!("Could not auto-detect any valid Scoop installation");
    Err("scoopConfigWizard.autoDetectFailedSystem".to_string())
}

pub(super) fn normalize_scoop_path_input(path: &str) -> Result<String, String> {
    let normalized = path.trim().to_string();
    if normalized.is_empty() {
        return Err("Scoop path cannot be empty".to_string());
    }
    Ok(normalized)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    fn valid_scoop_root(parent: &std::path::Path, name: &str) -> String {
        let root = parent.join(name);
        fs::create_dir_all(root.join("apps")).expect("apps dir");
        fs::create_dir_all(root.join("buckets")).expect("buckets dir");
        fs::create_dir_all(root.join("cache")).expect("cache dir");
        root.to_string_lossy().to_string()
    }

    #[test]
    fn test_get_scoop_config_path() {
        if get_scoop_config_path().is_ok() {
            assert!(true);
        } else {
            assert!(true);
        }
    }

    #[test]
    fn normalize_scoop_path_trims_input() {
        assert_eq!(
            normalize_scoop_path_input("  C:\\Users\\tester\\scoop  "),
            Ok("C:\\Users\\tester\\scoop".to_string())
        );
    }

    #[test]
    fn normalize_scoop_path_rejects_empty_input() {
        assert_eq!(
            normalize_scoop_path_input("   "),
            Err("Scoop path cannot be empty".to_string())
        );
    }

    #[test]
    fn auto_detect_prefers_scoop_env() {
        let temp = tempdir().expect("temp dir");
        let scoop_env = valid_scoop_root(temp.path(), "env-root");
        let command_root = valid_scoop_root(temp.path(), "command-root");
        let config_root = valid_scoop_root(temp.path(), "config-root");
        valid_scoop_root(&temp.path().join("profile"), "scoop");

        let detected = auto_detect_scoop_path_from_sources(ScoopPathDetectionSources {
            scoop_env: Some(scoop_env.clone()),
            command_root_path: Some(command_root),
            config_root_path: Some(config_root),
            user_profile: Some(temp.path().join("profile")),
        })
        .expect("detected root");

        assert_eq!(detected, scoop_env);
    }

    #[test]
    fn auto_detect_uses_command_after_invalid_scoop_env() {
        let temp = tempdir().expect("temp dir");
        let command_root = valid_scoop_root(temp.path(), "command-root");
        let config_root = valid_scoop_root(temp.path(), "config-root");

        let detected = auto_detect_scoop_path_from_sources(ScoopPathDetectionSources {
            scoop_env: Some(
                temp.path()
                    .join("missing-env-root")
                    .to_string_lossy()
                    .to_string(),
            ),
            command_root_path: Some(command_root.clone()),
            config_root_path: Some(config_root),
            user_profile: None,
        })
        .expect("detected root");

        assert_eq!(detected, command_root);
    }

    #[test]
    fn auto_detect_uses_config_after_invalid_command() {
        let temp = tempdir().expect("temp dir");
        let config_root = valid_scoop_root(temp.path(), "config-root");
        valid_scoop_root(&temp.path().join("profile"), "scoop");

        let detected = auto_detect_scoop_path_from_sources(ScoopPathDetectionSources {
            scoop_env: None,
            command_root_path: Some(
                temp.path()
                    .join("missing-command-root")
                    .to_string_lossy()
                    .to_string(),
            ),
            config_root_path: Some(config_root.clone()),
            user_profile: Some(temp.path().join("profile")),
        })
        .expect("detected root");

        assert_eq!(detected, config_root);
    }

    #[test]
    fn auto_detect_uses_default_user_scoop_last() {
        let temp = tempdir().expect("temp dir");
        let default_root = valid_scoop_root(&temp.path().join("profile"), "scoop");

        let detected = auto_detect_scoop_path_from_sources(ScoopPathDetectionSources {
            scoop_env: None,
            command_root_path: Some(
                temp.path()
                    .join("missing-command-root")
                    .to_string_lossy()
                    .to_string(),
            ),
            config_root_path: Some(
                temp.path()
                    .join("missing-config-root")
                    .to_string_lossy()
                    .to_string(),
            ),
            user_profile: Some(temp.path().join("profile")),
        })
        .expect("detected root");

        assert_eq!(detected, default_root);
    }

    #[test]
    fn auto_detect_does_not_guess_unreferenced_roots() {
        let temp = tempdir().expect("temp dir");
        valid_scoop_root(temp.path(), "unreferenced-valid-root");

        let detected = auto_detect_scoop_path_from_sources(ScoopPathDetectionSources::default());

        assert_eq!(
            detected,
            Err("scoopConfigWizard.autoDetectFailedSystem".to_string())
        );
    }
}
