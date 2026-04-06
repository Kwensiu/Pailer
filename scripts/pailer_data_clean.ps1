# Pailer Factory Reset Script
# This script simulates Pailer's factory reset functionality, cleaning all application data and registry

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8


Write-Host "WARNING: This will delete all Pailer application data and registry entries!" -ForegroundColor Red
Write-Host ""
Write-Host "Make sure Pailer is completely closed before proceeding." -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

$confirmation = Read-Host "Are you sure you want to continue? (y/n)"
if ($confirmation -ne 'y') {
    Write-Host "`nOperation cancelled.`n" -ForegroundColor Cyan
    Read-Host "Press Enter to exit"
    exit
}

Write-Host "`nStarting Pailer factory reset..." -ForegroundColor Yellow

# Define paths
$appDataDir = "$env:APPDATA\com.pailer.ks"
$oldAppDir = "$env:LOCALAPPDATA\pailer"

Write-Host "Cleaning application data directories..." -ForegroundColor Cyan

# Clean new application data directory
if (Test-Path $appDataDir) {
    Write-Host "> Deleting $appDataDir" -ForegroundColor Red
    Remove-Item -Path $appDataDir -Recurse -Force -ErrorAction SilentlyContinue
    if (!(Test-Path $appDataDir)) {
        Write-Host "✓ Successfully deleted $appDataDir" -ForegroundColor Green
    } else {
        Write-Host "⚠ Could not fully delete $appDataDir, some files may be locked" -ForegroundColor Yellow
    }
} else {
    Write-Host "> Directory does not exist: $appDataDir" -ForegroundColor Gray
}

# Clean old application data directory (backward compatibility)
if (Test-Path $oldAppDir) {
    Write-Host "> Deleting $oldAppDir" -ForegroundColor Red
    Remove-Item -Path $oldAppDir -Recurse -Force -ErrorAction SilentlyContinue
    if (!(Test-Path $oldAppDir)) {
        Write-Host "✓ Successfully deleted $oldAppDir" -ForegroundColor Green
    } else {
        Write-Host "⚠ Could not fully delete $oldAppDir, some files may be locked" -ForegroundColor Yellow
    }
} else {
    Write-Host "> Directory does not exist: $oldAppDir" -ForegroundColor Gray
}

Write-Host "Cleaning Windows registry..." -ForegroundColor Cyan

# Define registry keys to delete
$registryKeys = @(
    "HKCU:\Software\com.pailer.ks",
    "HKCU:\Software\Pailer",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Pailer",
    "HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Pailer"
)

foreach ($key in $registryKeys) {
    if (Test-Path $key) {
        Write-Host "> Deleting registry key: $key" -ForegroundColor Red
        reg delete $key /f 2>$null
        if (!(Test-Path $key)) {
            Write-Host "✓ Successfully deleted registry key: $key" -ForegroundColor Green
        } else {
            Write-Host "> Registry key does not exist or could not be deleted: $key" -ForegroundColor Gray
        }
    } else {
        Write-Host "> Registry key does not exist: $key" -ForegroundColor Gray
    }
}

Write-Host "Cleanup completed!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan
Write-Host "Note: This script has cleaned the following:" -ForegroundColor Yellow
Write-Host "- Application data directory: $appDataDir" -ForegroundColor White
Write-Host "- Old application data directory: $oldAppDir" -ForegroundColor White
Write-Host "- Related registry keys" -ForegroundColor White
Write-Host "Restart Pailer to see the first-run settings." -ForegroundColor Cyan

Read-Host "Press Enter to exit"
