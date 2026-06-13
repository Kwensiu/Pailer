use crate::state::AppState;
use serde::Deserialize;
use tauri::State;

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd)]
#[serde(rename_all = "camelCase")]
pub struct ProcessTerminationTarget {
    process_id: u32,
    process_name: String,
}

#[tauri::command]
pub async fn terminate_processes(
    process_targets: Vec<ProcessTerminationTarget>,
    force: Option<bool>,
) -> Result<(), String> {
    if process_targets.is_empty() {
        return Err("No process targets provided.".to_string());
    }

    terminate_processes_inner(process_targets, force.unwrap_or(false)).await
}

#[tauri::command]
pub async fn terminate_package_processes(
    state: State<'_, AppState>,
    package_name: String,
    force: Option<bool>,
) -> Result<(), String> {
    let package_name = package_name.trim().to_string();
    if package_name.is_empty() {
        return Err("No package name provided.".to_string());
    }

    terminate_package_processes_inner(state, package_name, force.unwrap_or(false)).await
}

#[cfg(windows)]
async fn terminate_processes_inner(
    process_targets: Vec<ProcessTerminationTarget>,
    force: bool,
) -> Result<(), String> {
    use std::collections::BTreeSet;

    let unique_targets: BTreeSet<ProcessTerminationTarget> = process_targets
        .into_iter()
        .filter(|target| target.process_id > 0 && !target.process_name.trim().is_empty())
        .collect();

    if unique_targets.is_empty() {
        return Err("No valid process targets provided.".to_string());
    }

    terminate_validated_targets(unique_targets.into_iter().collect(), force).await
}

#[cfg(windows)]
async fn terminate_package_processes_inner(
    state: State<'_, AppState>,
    package_name: String,
    force: bool,
) -> Result<(), String> {
    let targets = find_processes_for_package(state, &package_name).await?;
    if targets.is_empty() {
        return Ok(());
    }

    terminate_validated_targets(targets, force).await
}

#[cfg(windows)]
async fn terminate_validated_targets(
    process_targets: Vec<ProcessTerminationTarget>,
    force: bool,
) -> Result<(), String> {
    use tokio::process::Command;

    let mut failures = Vec::new();

    for target in process_targets {
        match current_process_name(target.process_id).await? {
            Some(current_name) if process_name_matches(&current_name, &target.process_name) => {}
            Some(current_name) => {
                failures.push(format!(
                    "PID {} is '{}', expected '{}'",
                    target.process_id, current_name, target.process_name
                ));
                continue;
            }
            None => {
                continue;
            }
        }

        let mut command = Command::new("taskkill");
        command.args(["/PID", &target.process_id.to_string(), "/T"]);
        if force {
            command.arg("/F");
        }

        let output = command.output().await.map_err(|err| {
            format!(
                "Failed to run taskkill for PID {}: {}",
                target.process_id, err
            )
        })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let message = if !stderr.is_empty() { stderr } else { stdout };

            if is_taskkill_process_already_gone(&message) {
                continue;
            }

            if current_process_name(target.process_id).await?.is_none() {
                continue;
            }

            if !force && wait_for_process_exit(target.process_id, 1000).await? {
                continue;
            }

            failures.push(format!("PID {}: {}", target.process_id, message));
            continue;
        }

        if !force && !wait_for_process_exit(target.process_id, 1000).await? {
            failures.push(format!(
                "PID {} is still running after safe termination",
                target.process_id
            ));
        }
    }

    if failures.is_empty() {
        Ok(())
    } else {
        Err(format!(
            "Failed to terminate process(es): {}",
            failures.join("; ")
        ))
    }
}

#[cfg(windows)]
async fn find_processes_for_package(
    state: State<'_, AppState>,
    package_name: &str,
) -> Result<Vec<ProcessTerminationTarget>, String> {
    let mut process_names = vec![package_name.to_string()];
    let package_run_names =
        crate::commands::info::get_package_run_entry_names(&state.scoop_path(), package_name)?;
    process_names.extend(package_run_names);

    process_names.sort_by_key(|name| normalize_process_name(name));
    process_names.dedup_by(|a, b| normalize_process_name(a) == normalize_process_name(b));

    let mut targets = Vec::new();
    for process_name in process_names {
        let matched = query_processes_by_name(&process_name).await?;
        targets.extend(matched);
    }

    targets.sort();
    targets.dedup();
    Ok(targets)
}

#[cfg(windows)]
async fn query_processes_by_name(
    process_name: &str,
) -> Result<Vec<ProcessTerminationTarget>, String> {
    use tokio::process::Command;

    let image_name = format!("{}.exe", normalize_process_name(process_name));
    let output = Command::new("tasklist")
        .args([
            "/FI",
            &format!("IMAGENAME eq {}", image_name),
            "/FO",
            "CSV",
            "/NH",
        ])
        .output()
        .await
        .map_err(|err| {
            format!(
                "Failed to query running process '{}': {}",
                process_name, err
            )
        })?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() || stdout.starts_with("INFO:") {
        return Ok(Vec::new());
    }

    parse_tasklist_csv(&stdout, process_name)
}

#[cfg(windows)]
async fn wait_for_process_exit(process_id: u32, timeout_ms: u64) -> Result<bool, String> {
    use tokio::time::{sleep, Duration, Instant};

    let deadline = Instant::now() + Duration::from_millis(timeout_ms);
    loop {
        if current_process_name(process_id).await?.is_none() {
            return Ok(true);
        }

        if Instant::now() >= deadline {
            return Ok(false);
        }

        sleep(Duration::from_millis(150)).await;
    }
}

#[cfg(windows)]
async fn current_process_name(process_id: u32) -> Result<Option<String>, String> {
    use tokio::process::Command;

    let output = Command::new("tasklist")
        .args([
            "/FI",
            &format!("PID eq {}", process_id),
            "/FO",
            "CSV",
            "/NH",
        ])
        .output()
        .await
        .map_err(|err| format!("Failed to query process PID {}: {}", process_id, err))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() || stdout.starts_with("INFO:") {
        return Ok(None);
    }

    let mut processes = parse_tasklist_csv(&stdout, "")?;
    Ok(processes.pop().map(|target| target.process_name))
}

#[cfg(windows)]
fn parse_tasklist_csv(
    output: &str,
    expected_name: &str,
) -> Result<Vec<ProcessTerminationTarget>, String> {
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(false)
        .from_reader(output.as_bytes());
    let mut targets = Vec::new();

    for record in reader.records() {
        let record = record.map_err(|err| format!("Failed to parse tasklist output: {}", err))?;
        let Some(process_name) = record.get(0).map(|name| name.to_string()) else {
            continue;
        };
        let Some(process_id) = record.get(1).and_then(|pid| pid.parse::<u32>().ok()) else {
            continue;
        };

        if expected_name.is_empty() || process_name_matches(&process_name, expected_name) {
            targets.push(ProcessTerminationTarget {
                process_id,
                process_name,
            });
        }
    }

    Ok(targets)
}

#[cfg(not(windows))]
async fn terminate_processes_inner(
    _process_targets: Vec<ProcessTerminationTarget>,
    _force: bool,
) -> Result<(), String> {
    Err("Terminating package processes is only supported on Windows.".to_string())
}

#[cfg(not(windows))]
async fn terminate_package_processes_inner(_package_name: String) -> Result<(), String> {
    Err("Terminating package processes is only supported on Windows.".to_string())
}

#[cfg(windows)]
fn normalize_process_name(name: &str) -> String {
    let lower = name.trim().trim_matches('"').to_ascii_lowercase();
    lower.strip_suffix(".exe").unwrap_or(&lower).to_string()
}

#[cfg(windows)]
fn process_name_matches(current_name: &str, expected_name: &str) -> bool {
    normalize_process_name(current_name) == normalize_process_name(expected_name)
}

#[cfg(windows)]
fn is_taskkill_process_already_gone(message: &str) -> bool {
    let normalized = message.to_ascii_lowercase();
    normalized.contains("not found") || normalized.contains("not running")
}

#[cfg(test)]
mod tests {
    #[cfg(windows)]
    use super::{is_taskkill_process_already_gone, parse_tasklist_csv, process_name_matches};

    #[test]
    #[cfg(windows)]
    fn process_name_match_ignores_case_and_exe_suffix() {
        assert!(process_name_matches("FlowScroll.exe", "flowscroll"));
    }

    #[test]
    #[cfg(windows)]
    fn process_name_mismatch_blocks_unrelated_pid() {
        assert!(!process_name_matches("notepad.exe", "flowscroll"));
    }

    #[test]
    #[cfg(windows)]
    fn taskkill_not_found_means_process_is_already_terminated() {
        assert!(is_taskkill_process_already_gone(
            "ERROR: The process \"16776\" not found."
        ));
    }

    #[test]
    #[cfg(windows)]
    fn taskkill_access_denied_remains_a_failure() {
        assert!(!is_taskkill_process_already_gone(
            "ERROR: The process with PID 1234 could not be terminated. Reason: Access is denied."
        ));
    }

    #[test]
    #[cfg(windows)]
    fn tasklist_parser_returns_matching_package_processes() {
        let output = "\"flowscroll.exe\",\"7600\",\"Console\",\"1\",\"33,100 K\"\n\"notepad.exe\",\"1\",\"Console\",\"1\",\"1,000 K\"";
        let targets = parse_tasklist_csv(output, "FlowScroll").unwrap();

        assert_eq!(targets.len(), 1);
        assert_eq!(targets[0].process_id, 7600);
        assert_eq!(targets[0].process_name, "flowscroll.exe");
    }
}
