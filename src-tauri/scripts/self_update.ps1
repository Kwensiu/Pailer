# Pailer Self-Update Script
# Target Process ID: {PID}
# Set console encoding to ensure proper display
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "Pailer Self-Update"


# Check PowerShell version and compatibility
$psVersion = $PSVersionTable.PSVersion.Major
Write-Host "PowerShell version: $psVersion" -ForegroundColor Gray
if ($psVersion -lt 3) {
    Write-Host "[WARNING] PowerShell version $psVersion detected. Some features may not work properly." -ForegroundColor Yellow
    Write-Host "Consider upgrading to PowerShell 5.1 or later for better compatibility." -ForegroundColor Yellow
    Write-Host ""
}

# Check if Get-FileHash is available
$fileHashAvailable = Get-Command Get-FileHash -ErrorAction SilentlyContinue
if (-not $fileHashAvailable) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "   PowerShell Compatibility Issue" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Get-FileHash command not found in your PowerShell environment." -ForegroundColor Yellow
    Write-Host "This will cause Scoop update to fail." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please update Pailer manually:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Method 1: Use Windows PowerShell (Recommended)" -ForegroundColor White
    Write-Host "  1. Press Win + X, select 'Windows PowerShell (Admin)'" -ForegroundColor Gray
    Write-Host "  2. Run: scoop update pailer" -ForegroundColor Green
    Write-Host ""
    Write-Host "Method 2: Use PowerShell 7+" -ForegroundColor White
    Write-Host "  1. Install: scoop install pwsh" -ForegroundColor Gray
    Write-Host "  2. Run: pwsh -Command 'scoop update pailer'" -ForegroundColor Green
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host "Get-FileHash command available, proceeding with update..." -ForegroundColor Green
Write-Host ""

# Simple timeout control
$timeout = 300  # 5 minutes
$startTime = Get-Date

function Test-Timeout {
    ((Get-Date) - $startTime).TotalSeconds -gt $timeout
}

# Clear screen and show header
Clear-Host
Write-Host "========================================" -ForegroundColor Green
Write-Host "         Pailer Self-Update Script       " -ForegroundColor Green  
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Function to wait for process to exit
function Wait-ForProcessExit {
    param($ProcessId, $Timeout = 10)
    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if ($process) {
        $elapsed = 0
        while (!$process.HasExited -and $elapsed -lt $Timeout) {
            Start-Sleep -Seconds 1
            $elapsed++
            $process.Refresh()
        }
        return $process.HasExited
    }
    return $true
}

# Get current Pailer process using specific PID
if (Test-Timeout) { exit 1 }
Write-Host "Step 1: Finding Pailer process..." -ForegroundColor Cyan
$pailerProcess = Get-Process -Id {PID} -ErrorAction SilentlyContinue
if ($pailerProcess) {
    Write-Host "[OK] Found Pailer process with PID: $($pailerProcess.Id)" -ForegroundColor Green
    $processId = $pailerProcess.Id
} else {
    Write-Host "[!] Pailer process (PID: {PID}) not found, proceeding with update..." -ForegroundColor Yellow
    $processId = $null
}

# Update Pailer using Scoop
if (Test-Timeout) { exit 1 }
Write-Host ""
Write-Host "Step 2: Running Scoop update..." -ForegroundColor Cyan
Write-Host "Command: scoop update pailer --force --skip-hash-check" -ForegroundColor Gray
Write-Host ""

try {
    # Close Pailer process gracefully first to avoid conflicts
    if ($processId) {
        if (Test-Timeout) { exit 1 }
        Write-Host "Closing Pailer process..." -ForegroundColor Yellow
        try {
            $processToClose = Get-Process -Id $processId -ErrorAction SilentlyContinue
            if ($processToClose -and !$processToClose.HasExited) {
                try {
                    # Try graceful shutdown first
                    $processToClose.CloseMainWindow() | Out-Null
                    
                    # Wait up to 5 seconds for graceful exit
                    $gracefulExitSuccess = $processToClose.WaitForExit(5000)
                    
                    if (!$gracefulExitSuccess) {
                        # Process didn't exit gracefully, force termination
                        Write-Host "Process didn't close gracefully, forcing termination..." -ForegroundColor Yellow
                        $processToClose.Kill()
                        
                        # Wait for forced termination to complete
                        $processToClose.WaitForExit(3000)
                    }
                    
                    Write-Host "[OK] Pailer process terminated" -ForegroundColor Green
                } catch {
                    # Process might have exited between our checks
                    if ($_.Exception.Message -like "*process is not running*" -or $_.Exception.Message -like "*has exited*") {
                        Write-Host "[OK] Pailer process already exited" -ForegroundColor Green
                    } else {
                        Write-Host "[!] Warning: Could not terminate process: $($_.Exception.Message)" -ForegroundColor Yellow
                    }
                }
            } else {
                Write-Host "[OK] Pailer process already exited" -ForegroundColor Green
            }
        } catch {
            Write-Host "[!] Warning: Could not access process: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
    
    # Update Pailer
    if (Test-Timeout) { exit 1 }
    Write-Host "Running Scoop update..." -ForegroundColor Yellow
    try {
        # Check if scoop command is available
        $scoopCommand = Get-Command scoop -ErrorAction SilentlyContinue
        if (-not $scoopCommand) {
            throw "Scoop command not found. Please ensure Scoop is properly installed."
        }
        
        # Execute scoop update
        Write-Host "Running: scoop update pailer" -ForegroundColor Gray
        $updateResult = & scoop update pailer 2>&1
        $updateExitCode = $LASTEXITCODE
        
        # Display output
        $updateResult | ForEach-Object { 
            if ($_ -match "error|failed") {
                Write-Host "  $_" -ForegroundColor Red
            } elseif ($_ -match "warning|warn") {
                Write-Host "  $_" -ForegroundColor Yellow
            } else {
                Write-Host "  $_" -ForegroundColor Gray
            }
        }
        
        if ($updateExitCode -ne 0) {
            throw "Scoop update failed with exit code: $updateExitCode"
        }
        
        Write-Host "[OK] Scoop update completed successfully!" -ForegroundColor Green
        
    } catch {
        # Re-throw to be caught by the outer try-catch
        throw
    }
    
    # Wait a moment for the update to complete
    if (Test-Timeout) { exit 1 }
    Write-Host ""
    Write-Host "Waiting for update to finalize..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    
    # Scoop already handles the installation, so we just need to restart if needed
    if (Test-Timeout) { exit 1 }
    Write-Host ""
    Write-Host "Step 3: Restarting Pailer..." -ForegroundColor Cyan
    try {
        # Check if Pailer is already running (Scoop might have restarted it)
        $pailerRunning = Get-Process -Name "pailer" -ErrorAction SilentlyContinue
        if ($pailerRunning) {
            Write-Host "[OK] Pailer is already running after update" -ForegroundColor Green
        } else {
            # Try to start Pailer using full path from scoop
            try {
                $pailerPath = scoop which pailer 2>$null
                if ($pailerPath) {
                    Start-Process -FilePath $pailerPath -WindowStyle Normal
                    Write-Host "[OK] Pailer restarted successfully" -ForegroundColor Green
                } else {
                    # Fallback to simple command
                    Start-Process "pailer" -WindowStyle Normal -ErrorAction Stop
                    Write-Host "[OK] Pailer restarted successfully" -ForegroundColor Green
                }
            } catch {
                Write-Host "[ERROR] Failed to restart Pailer automatically: $($_.Exception.Message)" -ForegroundColor Red
                Write-Host "Please restart Pailer manually from the Start Menu or command line." -ForegroundColor Yellow
            }
        }
    } catch {
        Write-Host "[ERROR] Failed to check Pailer status: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Please restart Pailer manually from the Start Menu or command line." -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "   Pailer self-update completed!        " -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    
    # Show completion message and wait
    Write-Host ""
    Write-Host "This window will close automatically in 5 seconds..." -ForegroundColor Gray
    for ($i = 5; $i -gt 0; $i--) {
        Write-Host -NoNewLine "`rClosing in $i seconds... "
        Start-Sleep -Seconds 1
    }
    Write-Host "`rClosing now!           " -ForegroundColor Green
    
} catch {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "   Update Failed" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please update Pailer manually:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Open Windows PowerShell (Admin)" -ForegroundColor White
    Write-Host "   Press Win + X, select 'Windows PowerShell (Admin)'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Run update command:" -ForegroundColor White
    Write-Host "   scoop update pailer" -ForegroundColor Green
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}
