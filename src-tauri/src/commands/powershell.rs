use serde::Serialize;
use std::process::Stdio;
use tauri::{Emitter, Listener, Window};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use tokio::sync::{mpsc, oneshot};

use lazy_static::lazy_static;
use std::sync::RwLock;

lazy_static! {
    pub static ref POWERSHELL_EXE: RwLock<String> = RwLock::new("auto".to_string());
}

pub const EVENT_OUTPUT: &str = "operation-output";
pub const EVENT_FINISHED: &str = "operation-finished";
pub const EVENT_CANCEL: &str = "cancel-operation";

const STDOUT_ERROR_PATTERNS: &[&str] = &[
    "error:", "failed", "fatal:", "exception:",
    "access to the path", "denied", "permission denied",
    "requires admin", "admin rights",
    "remove-item", "remove item",
    "cannot ", "unable to ", "not found",
];


/// Represents a line of output from a command, specifying its source (stdout or stderr).
#[derive(Serialize, Clone)]
pub struct StreamOutput {
    #[serde(rename = "operationId")]
    pub operation_id: String,
    pub line: String,
    pub source: String,
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
    pub timestamp: u64,
}

/// Creates a `tokio::process::Command` for running a PowerShell command without a visible window.
/// Prefers PowerShell Core (pwsh) if available, falls back to Windows PowerShell.
pub fn create_powershell_command(command_str: &str) -> Command {
    // Determine which PowerShell executable to use
    let exe = POWERSHELL_EXE.try_read().map(|guard| guard.clone()).unwrap_or_else(|_| "auto".to_string());
    let ps_exe: &str = if exe == "auto" {
        if is_pwsh_available() { "pwsh" } else { "powershell" }
    } else {
        exe.as_str()
    };

    let mut cmd = Command::new(ps_exe);

    let wrapped_command = format!(
        "$OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::InputEncoding = [System.Text.Encoding]::UTF8; {}",
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
    cmd.status()
        .map(|status| status.success())
        .unwrap_or(false)
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
    cmd.status()
        .map(|status| status.success())
        .unwrap_or(false)
}

/// Spawns a task to read lines from a stream (stdout or stderr) and sends them to the frontend.
///
/// It also sends any lines that indicate an error to the `error_tx` channel.
use tokio::io::AsyncRead;

fn spawn_output_stream_handler(
    stream: impl AsyncRead + Unpin + Send + 'static,
    source: &'static str,
    window: Window,
    output_event: String,
    error_tx: mpsc::Sender<String>,
    operation_id: String,
) {
    let mut reader = BufReader::new(stream).lines();
    let op_id = operation_id.clone();  // Clone once outside the loop

    tokio::spawn(async move {
        while let Ok(Some(line)) = reader.next_line().await {
            log::debug!("Output line [{}]: {}", source, line);

            let is_error_line = if source == "stderr" {
                true
            } else {
                let lower = line.to_lowercase();
                STDOUT_ERROR_PATTERNS.iter().any(|&pat| lower.contains(pat))
            };

            if is_error_line {
                let _ = error_tx.send(line.clone()).await.map_err(|e| {
                    log::error!("error_tx send failed: {}", e);
                });
            }

            let _ = window.emit(
                &output_event,
                StreamOutput {
                    line: line.clone(),
                    source: source.to_string(),
                    operation_id: op_id.clone(),
                },
            ).map_err(|e| {
                log::error!("emit failed for line '{}': {}", line, e);
            });
        }

        log::debug!("Output stream handler for {} ended", source);
    });
}

/// Sets up a listener for a cancellation event from the frontend.
///
/// When the event is received, it sends a signal through the `cancel_tx` channel.
fn setup_cancellation_handler(window: &Window, cancel_event: &str, cancel_tx: oneshot::Sender<()>) {
    let op_name = cancel_event.to_string();
    let mut cancel_tx_opt = Some(cancel_tx);

    // Clone the name for the closure to avoid borrowing issues.
    let op_name_clone = op_name.clone();
    window.once(&op_name, move |_| {
        log::warn!("Received cancellation request for {}", op_name_clone);
        if let Some(tx) = cancel_tx_opt.take() {
            let _ = tx.send(());
        }
    });
    
    log::info!("Set up cancellation handler for event: {}", cancel_event);
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
    cancel_event: &str,
    operation_id: String,
) -> Result<(), String> {
    log::info!("[{}] Starting: {}", operation_id, operation_name);

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

    let (error_tx, mut error_rx) = mpsc::channel::<String>(100);
    let (cancel_tx, cancel_rx) = oneshot::channel::<()>();

    setup_cancellation_handler(&window, cancel_event, cancel_tx);

    spawn_output_stream_handler(
        stdout,
        "stdout",
        window.clone(),
        output_event.to_string(),
        error_tx.clone(),
        operation_id.clone(),
    );
    spawn_output_stream_handler(
        stderr,
        "stderr",
        window.clone(),
        output_event.to_string(),
        error_tx,
        operation_id.clone(),
    );

    tokio::select! {
        status_res = child.wait() => {
            handle_command_completion(status_res, &operation_name, &window, finished_event, &mut error_rx, operation_id.clone()).await
        },
        _ = cancel_rx => {
            handle_cancellation(child, &operation_name, &window, finished_event, operation_id.clone()).await
        }
    }
}

/// Handles the completion of the command, checking for errors and emitting the final result.
async fn handle_command_completion(
    status_res: Result<std::process::ExitStatus, std::io::Error>,
    operation_name: &str,
    window: &Window,
    finished_event: &str,
    error_rx: &mut mpsc::Receiver<String>,
    operation_id: String,
) -> Result<(), String> {
    let status = status_res.map_err(|e| {
        log::error!("[{}] Process wait failed: {}", operation_id, e);
        format!("Failed to wait on child process for {}: {}", operation_name, e)
    })?;
    
    let success = status.success();
    log::info!("[{}] Completed: {} (success: {})", operation_id, operation_name, success);

    // Collect all error messages
    let mut error_messages = Vec::new();
    while let Ok(error_line) = error_rx.try_recv() {
        error_messages.push(error_line);
    }

    let has_errors = !error_messages.is_empty();
    let was_successful = status.success() && !has_errors;
    let error_count = if has_errors { Some(error_messages.len()) } else { None };

    // Log key error summary only if there are errors
    if has_errors {
        log::warn!("[{}] {} errors detected", operation_id, error_messages.len());
        for (i, msg) in error_messages.iter().take(3).enumerate() {
            log::warn!("[{}] Error {}: {}", operation_id, i + 1, msg);
        }
        if error_messages.len() > 3 {
            log::warn!("[{}] ... and {} more errors", operation_id, error_messages.len() - 3);
        }
    }

    if let Err(e) = window.emit(
        finished_event,
        CommandResult {
            success: was_successful,
            operation_name: operation_name.to_string(),
            error_count: error_count,
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
            error_count: Some(0), // Cancelled operation, not an error
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