use crate::commands::powershell;
use tokio::io::AsyncReadExt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScoopUpdateAllOutput {
    pub stdout: String,
    pub stderr: String,
    pub summary_lines: Vec<String>,
}

impl ScoopUpdateAllOutput {
    pub fn display_lines(&self) -> Vec<String> {
        if self.summary_lines.is_empty() {
            vec!["All packages are up to date.".to_string()]
        } else {
            self.summary_lines.clone()
        }
    }
}

pub async fn run_update_all_headless() -> Result<ScoopUpdateAllOutput, String> {
    let update_all_command = powershell::build_scoop_update_all_command(true);
    let mut cmd = powershell::create_powershell_command(&update_all_command);
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn scoop update *: {}", e))?;

    let stdout_task = {
        let mut out = child.stdout.take();
        tokio::spawn(async move {
            let mut buf = Vec::new();
            if let Some(mut stream) = out.take() {
                stream
                    .read_to_end(&mut buf)
                    .await
                    .map_err(|e| format!("Failed to read stdout: {}", e))?;
            }
            Ok::<String, String>(String::from_utf8_lossy(&buf).to_string())
        })
    };

    let stderr_task = {
        let mut err = child.stderr.take();
        tokio::spawn(async move {
            let mut buf = Vec::new();
            if let Some(mut stream) = err.take() {
                stream
                    .read_to_end(&mut buf)
                    .await
                    .map_err(|e| format!("Failed to read stderr: {}", e))?;
            }
            Ok::<String, String>(String::from_utf8_lossy(&buf).to_string())
        })
    };

    let status = child
        .wait()
        .await
        .map_err(|e| format!("Failed to execute scoop update *: {}", e))?;
    let stdout = stdout_task
        .await
        .map_err(|e| format!("Failed to join stdout task: {}", e))??;
    let stderr = stderr_task
        .await
        .map_err(|e| format!("Failed to join stderr task: {}", e))??;

    let output = ScoopUpdateAllOutput {
        summary_lines: extract_update_summary_lines(&stdout),
        stdout,
        stderr,
    };

    if status.success() {
        Ok(output)
    } else {
        log_failed_update_all_output(&status, &output);
        Err(format_headless_update_error(&output))
    }
}

fn extract_update_summary_lines(stdout: &str) -> Vec<String> {
    stdout
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            if is_update_summary_line(trimmed) {
                Some(trimmed.to_string())
            } else {
                None
            }
        })
        .collect()
}

fn is_update_summary_line(trimmed: &str) -> bool {
    !trimmed.is_empty()
        && (trimmed.contains("Updating")
            || trimmed.contains("Updated")
            || trimmed.contains("up to date")
            || trimmed.contains("Installing")
            || trimmed.contains("Downloading")
            || trimmed.contains("Extracting")
            || trimmed.contains("Linking")
            || trimmed.contains("WARN")
            || trimmed.contains("ERROR"))
}

fn format_headless_update_error(output: &ScoopUpdateAllOutput) -> String {
    let error_lines: Vec<String> = output
        .stderr
        .lines()
        .chain(output.stdout.lines())
        .filter(|line| !line.trim().is_empty())
        .take(10)
        .map(|line| line.to_string())
        .collect();

    format!("Headless package update failed: {}", error_lines.join("; "))
}

fn log_failed_update_all_output(status: &std::process::ExitStatus, output: &ScoopUpdateAllOutput) {
    log::warn!(
        "Headless update_all_packages exited with status: {}",
        status
    );
    if !output.stdout.is_empty() {
        log::debug!(
            "Partial stdout: {}",
            output
                .stdout
                .lines()
                .take(20)
                .collect::<Vec<_>>()
                .join(" | ")
        );
    }

    if !output.stderr.is_empty() {
        log::debug!("Headless update stderr: {}", output.stderr);
    }
}

#[cfg(test)]
mod tests {
    use super::{extract_update_summary_lines, format_headless_update_error, ScoopUpdateAllOutput};

    #[test]
    fn extracts_only_meaningful_update_lines() {
        let stdout = "\
Noise
Updating git
Downloading git
Extracting git
Linking ~\\scoop\\apps\\git\\current
git is already up to date
WARN skipped held package
ERROR failed package
";

        assert_eq!(
            extract_update_summary_lines(stdout),
            vec![
                "Updating git",
                "Downloading git",
                "Extracting git",
                "Linking ~\\scoop\\apps\\git\\current",
                "git is already up to date",
                "WARN skipped held package",
                "ERROR failed package",
            ]
        );
    }

    #[test]
    fn display_lines_falls_back_when_stdout_has_no_summary() {
        let output = ScoopUpdateAllOutput {
            stdout: "Done\n".to_string(),
            stderr: String::new(),
            summary_lines: vec![],
        };

        assert_eq!(output.display_lines(), vec!["All packages are up to date."]);
    }

    #[test]
    fn error_message_prefers_stderr_before_stdout_and_caps_lines() {
        let output = ScoopUpdateAllOutput {
            stderr: "stderr one\nstderr two\n".to_string(),
            stdout: "stdout one\nstdout two\n".to_string(),
            summary_lines: vec![],
        };

        assert_eq!(
            format_headless_update_error(&output),
            "Headless package update failed: stderr one; stderr two; stdout one; stdout two"
        );
    }
}
