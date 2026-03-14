use crate::commands::powershell;
use serde::Serialize;
use tauri::{Emitter, Window, AppHandle};
use tokio::io::{AsyncBufReadExt, BufReader};

/// Generate operation name for VirusTotal scanning
fn generate_virustotal_operation_name(package_name: &str) -> String {
    format!("Scanning {}", package_name)
}

/// Represents the final result of a command with minimal structured data for frontend i18n.
#[derive(Serialize, Clone, Debug)]
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

/// Scans a package using `scoop virustotal` and emits the results.
///
/// This command streams its output to the frontend and emits a `operation-finished`
/// event with a `CommandResult` payload upon completion.
#[tauri::command]
pub async fn scan_package(
    window: Window,
    _app: AppHandle,
    package_name: String,
    bucket: String,
) -> Result<(), String> {
    // Generate consistent operation ID at the beginning
    let operation_id = format!("virustotal-{}-{}", package_name, 
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis());

    // The `bucket` parameter may be an empty string or the literal "None"
    // if the user does not specify a bucket.
    let command_str = if bucket.is_empty() || bucket.eq_ignore_ascii_case("none") {
        format!("scoop virustotal {}", package_name)
    } else {
        format!("scoop virustotal {}/{}", bucket, package_name)
    };

    log::info!("Executing VirusTotal scan: {}", &command_str);

    let mut child = powershell::create_powershell_command(&command_str)
        .spawn()
        .map_err(|e| format!("Failed to spawn 'scoop virustotal': {}", e))?;

    // We manually handle stream output here because `scoop virustotal` has a unique
    // set of exit codes that don't fit the standard success/fail model of the
    // generic `run_and_stream_command` function.

    // Capture stdout and stderr.
    let stdout = child
        .stdout
        .take()
        .ok_or("Child process did not have a handle to stdout")?;
    let stderr = child
        .stderr
        .take()
        .ok_or("Child process did not have a handle to stderr")?;

    let mut stdout_reader = BufReader::new(stdout).lines();
    let mut stderr_reader = BufReader::new(stderr).lines();

    // Spawn tasks to forward output to the frontend.
    let window_clone = window.clone();
    let operation_id_clone = operation_id.clone(); // Use the consistent operation_id
    tokio::spawn(async move {
        while let Ok(Some(line)) = stdout_reader.next_line().await {
            log::info!("virustotal stdout: {}", &line);
            if let Err(e) = window_clone.emit(
                "operation-output",
                powershell::StreamOutput {
                    line,
                    source: "stdout".to_string(),
                    operation_id: operation_id_clone.clone(),
                },
            ) {
                log::error!("Failed to emit stdout event: {}", e);
            }
        }
    });

    let window_clone = window.clone();
    let operation_id_clone2 = operation_id.clone();
    tokio::spawn(async move {
        while let Ok(Some(line)) = stderr_reader.next_line().await {
            log::error!("virustotal stderr: {}", &line);
            if let Err(e) = window_clone.emit(
                "operation-output",
                powershell::StreamOutput {
                    line,
                    source: "stderr".to_string(),
                    operation_id: operation_id_clone2.clone(),
                },
            ) {
                log::error!("Failed to emit stderr event: {}", e);
            }
        }
    });

    // Wait for the command to finish.
    let status = child
        .wait()
        .await
        .map_err(|e| format!("Failed to wait on child process: {}", e))?;
    let exit_code = status.code().unwrap_or(1); // Default to a generic error code.

    // Interpret the exit code to determine the scan result.
    // See: https://github.com/rasa/scoop-virustotal#exit-codes
    let result = match exit_code {
        0 => {
            // Success case - no threats found
            CommandResult {
                success: true,
                operation_id: operation_id.clone(), // Use consistent operation_id
                operation_name: generate_virustotal_operation_name(&package_name),
                error_count: None,
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64,
            }
        },
        2 => {
            // Detections found - this should be marked as failure for user awareness
            CommandResult {
                success: false,  // Changed: threats found should be marked as failed
                operation_id: operation_id.clone(), // Use consistent operation_id
                operation_name: generate_virustotal_operation_name(&package_name),
                error_count: Some(1), // 1 error = detections found
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64,
            }
        },
        16 => {
            // API key missing - configuration error
            CommandResult {
                success: false,  // Changed: API key missing is a failure
                operation_id: operation_id.clone(), // Use consistent operation_id
                operation_name: generate_virustotal_operation_name(&package_name),
                error_count: Some(1), // 1 error = API key missing
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64,
            }
        },
        _ => {
            // Other errors - command execution failed
            CommandResult {
                success: false,
                operation_id: operation_id.clone(), // Use consistent operation_id
                operation_name: generate_virustotal_operation_name(&package_name),
                error_count: Some(1), // 1 error = unknown error
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64,
            }
        },
    };

    log::info!("VirusTotal scan finished: {:?}", result);

    window
        .emit("operation-finished", result)
        .map_err(|e| format!("Failed to emit scan result: {}", e))?;

    Ok(())
}
