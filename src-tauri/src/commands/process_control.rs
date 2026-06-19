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
    let mut failures = Vec::new();

    for target in process_targets {
        match current_process_name(target.process_id)? {
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

        let result = if force {
            force_terminate_process(target.process_id)
        } else {
            request_process_close(target.process_id)
        };

        if let Err(message) = result {
            if current_process_name(target.process_id)?.is_none() {
                continue;
            }

            failures.push(format!("PID {}: {}", target.process_id, message));
            continue;
        }

        if !wait_for_process_exit(target.process_id, 3000).await? {
            let message = if force {
                "is still running after force termination".to_string()
            } else {
                "did not exit after a safe close request".to_string()
            };
            failures.push(format!("PID {} {}", target.process_id, message));
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
    list_processes_by_name(process_name)
}

#[cfg(windows)]
async fn wait_for_process_exit(process_id: u32, timeout_ms: u64) -> Result<bool, String> {
    use tokio::time::{sleep, Duration, Instant};

    let deadline = Instant::now() + Duration::from_millis(timeout_ms);
    loop {
        if current_process_name(process_id)?.is_none() {
            return Ok(true);
        }

        if Instant::now() >= deadline {
            return Ok(false);
        }

        sleep(Duration::from_millis(150)).await;
    }
}

#[cfg(windows)]
fn current_process_name(process_id: u32) -> Result<Option<String>, String> {
    Ok(list_processes()?
        .into_iter()
        .find(|target| target.process_id == process_id)
        .map(|target| target.process_name))
}

#[cfg(windows)]
fn list_processes_by_name(process_name: &str) -> Result<Vec<ProcessTerminationTarget>, String> {
    Ok(list_processes()?
        .into_iter()
        .filter(|target| process_name_matches(&target.process_name, process_name))
        .collect())
}

#[cfg(windows)]
fn list_processes() -> Result<Vec<ProcessTerminationTarget>, String> {
    use std::mem::size_of;
    use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };

    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot == INVALID_HANDLE_VALUE {
            return Err(format!(
                "Failed to create process snapshot: {}",
                std::io::Error::last_os_error()
            ));
        }

        let mut entry = std::mem::zeroed::<PROCESSENTRY32W>();
        entry.dwSize = size_of::<PROCESSENTRY32W>() as u32;

        let mut targets = Vec::new();
        let mut has_entry = Process32FirstW(snapshot, &mut entry) != 0;

        while has_entry {
            let nul_index = entry
                .szExeFile
                .iter()
                .position(|code_unit| *code_unit == 0)
                .unwrap_or(entry.szExeFile.len());
            let process_name = String::from_utf16_lossy(&entry.szExeFile[..nul_index]);
            if !process_name.is_empty() {
                targets.push(ProcessTerminationTarget {
                    process_id: entry.th32ProcessID,
                    process_name,
                });
            }

            has_entry = Process32NextW(snapshot, &mut entry) != 0;
        }

        let _ = CloseHandle(snapshot);
        Ok(targets)
    }
}

#[cfg(windows)]
fn request_process_close(process_id: u32) -> Result<(), String> {
    use windows_sys::Win32::Foundation::{HWND, LPARAM};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowThreadProcessId, PostMessageW, WM_CLOSE,
    };

    struct CloseRequest {
        process_id: u32,
        posted: bool,
    }

    unsafe extern "system" fn enum_windows_proc(hwnd: HWND, lparam: LPARAM) -> i32 {
        let request = &mut *(lparam as *mut CloseRequest);
        let mut window_process_id = 0;
        GetWindowThreadProcessId(hwnd, &mut window_process_id);

        if window_process_id == request.process_id && PostMessageW(hwnd, WM_CLOSE, 0, 0) != 0 {
            request.posted = true;
        }

        1
    }

    let mut request = CloseRequest {
        process_id,
        posted: false,
    };

    unsafe {
        EnumWindows(
            Some(enum_windows_proc),
            &mut request as *mut CloseRequest as LPARAM,
        );
    }

    if request.posted {
        Ok(())
    } else {
        Err("No window found for safe close request".to_string())
    }
}

#[cfg(windows)]
fn force_terminate_process(process_id: u32) -> Result<(), String> {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Threading::{OpenProcess, TerminateProcess, PROCESS_TERMINATE};

    unsafe {
        let handle = OpenProcess(PROCESS_TERMINATE, 0, process_id);
        if handle.is_null() {
            return Err(format!(
                "Failed to open process for termination: {}",
                std::io::Error::last_os_error()
            ));
        }

        let terminated = TerminateProcess(handle, 1);
        let terminate_error = std::io::Error::last_os_error();
        CloseHandle(handle);

        if terminated == 0 {
            Err(format!("Failed to terminate process: {}", terminate_error))
        } else {
            Ok(())
        }
    }
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

#[cfg(test)]
mod tests {
    #[cfg(windows)]
    use super::process_name_matches;

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
}
