use serde::Serialize;
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::process::Stdio;
use tauri::{Emitter, Window};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};

use lazy_static::lazy_static;
use std::collections::HashSet;
use std::sync::RwLock;
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};
use tokio::time::{sleep, Duration};

lazy_static! {
    pub static ref POWERSHELL_EXE: RwLock<String> = RwLock::new("auto".to_string());
    pub static ref CANCEL_REQUESTED: RwLock<HashSet<String>> = RwLock::new(HashSet::new());
}

pub const EVENT_OUTPUT: &str = "operation-output";
pub const EVENT_FINISHED: &str = "operation-finished";
pub const EVENT_CANCEL: &str = "cancel-operation";

#[tauri::command]
pub fn request_cancel_operation(operation_id: String) -> Result<(), String> {
    match CANCEL_REQUESTED.write() {
        Ok(mut pending) => {
            pending.insert(operation_id.clone());
            log::info!(
                "Queued cancellation request for operation: {}",
                operation_id
            );
            Ok(())
        }
        Err(_) => Err("Failed to queue cancellation request due to lock contention".to_string()),
    }
}

fn take_cancel_requested(operation_id: &str) -> bool {
    match CANCEL_REQUESTED.write() {
        Ok(mut pending) => pending.remove(operation_id),
        Err(_) => false,
    }
}

async fn wait_for_cancel_request(operation_id: String) {
    loop {
        if take_cancel_requested(&operation_id) {
            break;
        }
        sleep(Duration::from_millis(50)).await;
    }
}

/// Executes a simple PowerShell command and returns its stdout output.
/// Used for non-streaming operations like reading/writing Scoop config.
pub async fn run_simple_command(command_str: &str) -> Result<String, String> {
    let mut cmd = create_powershell_command(command_str);
    let output = cmd
        .output()
        .await
        .map_err(|e| format!("Failed to execute command: {}", e))?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let err_msg = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if err_msg.is_empty() {
            Err(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            Err(err_msg)
        }
    }
}

fn contains_error_keywords(line: &str) -> bool {
    // TODO(elevation-followups): Keep this matcher conservative. When adding new patterns,
    // verify they do not create false positives and align with frontend detection in
    // src/components/modals/OperationModal.tsx (hasElevationError).
    let trimmed = line.trim_start();
    if trimmed.is_empty() {
        return false;
    }

    let lower = trimmed.to_lowercase();

    // Explicit hard-error signals that should fail the operation even if exit code is 0.
    // Keep these strict to avoid false positives from generic diagnostic text.
    if lower.contains("requires admin rights")
        || lower.contains("requires administrator")
        || lower.contains("permission denied")
        || lower.contains("access is denied")
        || lower.contains("access denied")
        || lower.contains("unauthorizedaccessexception")
    {
        return true;
    }

    // Match only explicit ERROR prefixes, e.g. "ERROR xxx".
    lower.starts_with("error ") || lower.starts_with("error:")
}

fn contains_warning_keywords(line: &str) -> bool {
    let trimmed = line.trim_start();
    if trimmed.is_empty() {
        return false;
    }

    // Keep this intentionally minimal and tool-agnostic.
    // It is used only to raise a "warning" flag for successful commands.
    let lower = trimmed.to_lowercase();
    if lower.starts_with("warn") {
        return true;
    }

    // Common warning/error indicators (case-insensitive)
    let indicators = [
        "warn",
        "warning",
        "not found",
        "failed",
        "cannot",
        "unable to",
        "denied",
        "permission denied",
        "access denied",
    ];
    indicators.iter().any(|&pat| lower.contains(pat))
}

/// Represents a line of output from a command, specifying its source (stdout or stderr).
#[derive(Serialize, Clone)]
pub struct StreamOutput {
    #[serde(rename = "operationId")]
    pub operation_id: String,
    pub line: String,
    pub source: String,
}

/// Explicit terminal status emitted to the frontend so it no longer has to
/// infer cancellation from the combination of success/errorCount/warningCount.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "kebab-case")]
pub enum FinalStatus {
    Success,
    Warning,
    Error,
    Cancelled,
}

/// Represents the final result of a command with minimal structured data for frontend i18n.
#[derive(Serialize, Clone)]
pub struct CommandResult {
    pub success: bool,
    #[serde(rename = "operationId")]
    pub operation_id: String,
    #[serde(rename = "operationName")]
    pub operation_name: String,
    #[serde(rename = "errorCount")]
    pub error_count: Option<usize>,
    #[serde(rename = "warningCount")]
    pub warning_count: Option<usize>,
    #[serde(rename = "finalStatus")]
    pub final_status: FinalStatus,
    pub timestamp: u64,
}

/// Returns the resolved PowerShell executable name respecting user configuration.
/// Prefers PowerShell Core (pwsh) when set to "auto", falls back to Windows PowerShell.
pub fn resolve_powershell_exe() -> String {
    let exe = POWERSHELL_EXE
        .try_read()
        .map(|guard| guard.clone())
        .unwrap_or_else(|_| "auto".to_string());
    if exe == "auto" {
        if is_pwsh_available() {
            "pwsh".to_string()
        } else {
            "powershell".to_string()
        }
    } else {
        exe
    }
}

/// Creates a `tokio::process::Command` for running a PowerShell command without a visible window.
/// Prefers PowerShell Core (pwsh) if available, falls back to Windows PowerShell.
pub fn create_powershell_command(command_str: &str) -> Command {
    let ps_exe = resolve_powershell_exe();

    let mut cmd = Command::new(&ps_exe);

    let wrapped_command = format!(
        "$OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::InputEncoding = [System.Text.Encoding]::UTF8; \
        $env:TERM = 'xterm-256color'; \
        $env:FORCE_COLOR = '1'; \
        if ($PSStyle) {{ $PSStyle.OutputRendering = 'Ansi' }}; \
        $ErrorView = 'NormalView'; \
        {}",
        command_str
    );

    cmd.args(["-NoProfile", "-Command", &wrapped_command])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Prevents a console window from appearing on Windows.
    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW

    cmd
}

/// Checks if PowerShell Core (pwsh) is available on the system.
pub fn is_pwsh_available() -> bool {
    let mut cmd = std::process::Command::new("pwsh");
    cmd.arg("--version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    // Prevents a console window from appearing on Windows.
    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    cmd.status().map(|status| status.success()).unwrap_or(false)
}

/// Checks if Windows PowerShell is available on the system.
pub fn is_powershell_available() -> bool {
    let mut cmd = std::process::Command::new("powershell");
    cmd.arg("-Command")
        .arg("$PSVersionTable.PSVersion")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    // Prevents a console window from appearing on Windows.
    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    cmd.status().map(|status| status.success()).unwrap_or(false)
}

/// Spawns a task to read lines from a stream (stdout or stderr) and sends them to the frontend.
///
/// It also sends any lines that indicate an error to the `error_tx` channel.
use tokio::io::AsyncRead;

fn spawn_output_reader(
    stream: impl AsyncRead + Unpin + Send + 'static,
    source: &'static str,
    window: Window,
    output_event: String,
    error_count: Arc<AtomicUsize>,
    warning_count: Arc<AtomicUsize>,
    operation_id: String,
) {
    let mut reader = BufReader::new(stream).lines();
    let op_id = operation_id.clone(); // Clone once outside the loop

    tokio::spawn(async move {
        while let Ok(Some(line)) = reader.next_line().await {
            log::debug!("Output line [{}]: {}", source, line);

            if contains_error_keywords(&line) {
                error_count.fetch_add(1, Ordering::Relaxed);
            } else if contains_warning_keywords(&line) {
                warning_count.fetch_add(1, Ordering::Relaxed);
            }

            let _ = window
                .emit(
                    &output_event,
                    StreamOutput {
                        line: line.clone(),
                        source: source.to_string(),
                        operation_id: op_id.clone(),
                    },
                )
                .map_err(|e| {
                    log::error!("emit failed for line '{}': {}", line, e);
                });
        }

        log::debug!("Output stream handler for {} ended", source);
    });
}

/// Executes a long-running command and streams its output to the frontend.
///
/// - Emits `output_event` with `StreamOutput` for each line of output.
/// - Emits `finished_event` with `CommandResult` when command completes.
/// - Listens for `cancel_event` to terminate the process.
pub async fn run_and_stream_command(
    window: Window,
    command_str: String,
    operation_name: String,
    output_event: &str,
    finished_event: &str,
    _cancel_event: &str,
    operation_id: String,
) -> Result<(), String> {
    log::info!("[{}] Starting: {}", operation_id, operation_name);

    if take_cancel_requested(&operation_id) {
        log::warn!(
            "[{}] Cancellation requested before command start; skipping execution",
            operation_id
        );
        if let Err(e) = window.emit(
            finished_event,
            CommandResult {
                success: false,
                operation_name: operation_name.clone(),
                error_count: Some(0),
                warning_count: Some(0),
                final_status: FinalStatus::Cancelled,
                operation_id: operation_id.clone(),
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64,
            },
        ) {
            log::error!("Failed to emit pre-start cancellation event: {}", e);
        }
        return Err(format!("{} cancelled by user", operation_name));
    }

    let mut child = create_powershell_command(&command_str)
        .spawn()
        .map_err(|e| {
            log::error!("[{}] Process spawn failed: {}", operation_id, e);
            format!("Failed to spawn command '{}': {}", command_str, e)
        })?;

    let stdout = child
        .stdout
        .take()
        .expect("Child process did not have a handle to stdout");
    let stderr = child
        .stderr
        .take()
        .expect("Child process did not have a handle to stderr");

    let error_count = Arc::new(AtomicUsize::new(0));
    let warning_count = Arc::new(AtomicUsize::new(0));
    let cancel_poll_operation_id = operation_id.clone();

    spawn_output_reader(
        stdout,
        "stdout",
        window.clone(),
        output_event.to_string(),
        error_count.clone(),
        warning_count.clone(),
        operation_id.clone(),
    );
    spawn_output_reader(
        stderr,
        "stderr",
        window.clone(),
        output_event.to_string(),
        error_count.clone(),
        warning_count.clone(),
        operation_id.clone(),
    );

    let result = tokio::select! {
        status_res = child.wait() => {
            handle_command_completion(
                status_res,
                &operation_name,
                &window,
                finished_event,
                error_count.clone(),
                warning_count.clone(),
                operation_id.clone(),
            ).await
        },
        _ = wait_for_cancel_request(cancel_poll_operation_id) => {
            handle_cancellation(child, &operation_name, &window, finished_event, operation_id.clone()).await
        }
    };

    // Best-effort cleanup for late or duplicate cancel requests.
    let _ = take_cancel_requested(&operation_id);

    result
}

/// Handles the completion of the command, checking for errors and emitting the final result.
async fn handle_command_completion(
    status_res: Result<std::process::ExitStatus, std::io::Error>,
    operation_name: &str,
    window: &Window,
    finished_event: &str,
    error_count: Arc<AtomicUsize>,
    warning_count: Arc<AtomicUsize>,
    operation_id: String,
) -> Result<(), String> {
    let status = status_res.map_err(|e| {
        log::error!("[{}] Process wait failed: {}", operation_id, e);
        format!(
            "Failed to wait on child process for {}: {}",
            operation_name, e
        )
    })?;

    let success = status.success();
    log::info!(
        "[{}] Completed: {} (success: {})",
        operation_id,
        operation_name,
        success
    );

    // Command is successful if process exits with code 0
    let process_successful = status.success();

    let detected_errors = error_count.load(Ordering::Relaxed);
    let detected_warnings = warning_count.load(Ordering::Relaxed);

    let error_count = if detected_errors > 0 {
        Some(detected_errors)
    } else {
        None
    };
    let warning_count = if detected_warnings > 0 {
        Some(detected_warnings)
    } else {
        None
    };

    // Consider command failed if hard error lines were detected, even when exit code is 0.
    let was_successful = process_successful && detected_errors == 0;

    let final_status = if was_successful {
        if warning_count.is_some() {
            FinalStatus::Warning
        } else {
            FinalStatus::Success
        }
    } else {
        FinalStatus::Error
    };

    if let Err(e) = window.emit(
        finished_event,
        CommandResult {
            success: was_successful,
            operation_name: operation_name.to_string(),
            error_count: error_count,
            warning_count: warning_count,
            final_status,
            operation_id: operation_id,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
        },
    ) {
        log::error!("Failed to emit finished event: {}", e);
    }

    if was_successful {
        Ok(())
    } else {
        // Use operation name for better context, frontend will handle i18n
        Err(format!("{} failed", operation_name))
    }
}

/// Handles the cancellation of the command, killing the process and emitting a cancellation message.
async fn handle_cancellation(
    mut child: Child,
    operation_name: &str,
    window: &Window,
    finished_event: &str,
    operation_id: String,
) -> Result<(), String> {
    log::warn!("Cancelling operation: {}", operation_name);

    // Try to kill the process
    if let Err(e) = child.kill().await {
        log::error!("Failed to kill child process: {}", e);
    }

    if let Err(e) = window.emit(
        finished_event,
        CommandResult {
            success: false,
            operation_name: operation_name.to_string(),
            error_count: Some(0),   // Cancelled operation, not an error
            warning_count: Some(0), // No warnings for cancelled operations
            final_status: FinalStatus::Cancelled,
            operation_id: operation_id,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
        },
    ) {
        log::error!("Failed to emit cancellation event: {}", e);
    }

    Err(format!("{} cancelled by user", operation_name))
}
