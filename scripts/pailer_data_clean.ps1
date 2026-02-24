# Pailer Factory Reset Script
# This script simulates Pailer's factory reset functionality, cleaning all application data and registry

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8


Write-Host "WARNING: This will delete all Pailer application data and registry entries!" -ForegroundColor Red
Write-Host "警告：这将删除所有 Pailer 应用数据和注册表项！" -ForegroundColor Red
Write-Host ""
Write-Host "Make sure Pailer is completely closed before proceeding." -ForegroundColor Yellow
Write-Host "确保 Pailer 已完全关闭后再继续。" -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

$confirmation = Read-Host "Are you sure you want to continue? (y/n)`n确定要继续吗？(y/n)"
if ($confirmation -ne 'y') {
    Write-Host "`nOperation cancelled.`n操作已取消。`n" -ForegroundColor Cyan
    Read-Host "Press Enter to exit / 按 Enter 键退出"
    exit
}

Write-Host "`nStarting Pailer factory reset..." -ForegroundColor Yellow
Write-Host "开始 Pailer 工厂重置...`n" -ForegroundColor Yellow

# Define paths
$appDataDir = "$env:APPDATA\com.pailer.ks"
$oldAppDir = "$env:LOCALAPPDATA\pailer"

Write-Host "Cleaning application data directories..." -ForegroundColor Cyan
Write-Host "清理应用数据目录...`n" -ForegroundColor Cyan

# Clean new application data directory
if (Test-Path $appDataDir) {
    Write-Host "> Deleting $appDataDir" -ForegroundColor Red
    Write-Host "> 删除 $appDataDir`n" -ForegroundColor Red
    Remove-Item -Path $appDataDir -Recurse -Force -ErrorAction SilentlyContinue
    if (!(Test-Path $appDataDir)) {
        Write-Host "✓ Successfully deleted $appDataDir" -ForegroundColor Green
        Write-Host "✓ 已成功删除 $appDataDir" -ForegroundColor Green
    } else {
        Write-Host "⚠ Could not fully delete $appDataDir, some files may be locked" -ForegroundColor Yellow
        Write-Host "⚠ 无法完全删除 $appDataDir，可能有文件被锁定" -ForegroundColor Yellow
    }
} else {
    Write-Host "> Directory does not exist: $appDataDir" -ForegroundColor Gray
    Write-Host "> 目录不存在: $appDataDir`n" -ForegroundColor Gray
}

# Clean old application data directory (backward compatibility)
if (Test-Path $oldAppDir) {
    Write-Host "> Deleting $oldAppDir" -ForegroundColor Red
    Write-Host "> 删除 $oldAppDir`n" -ForegroundColor Red
    Remove-Item -Path $oldAppDir -Recurse -Force -ErrorAction SilentlyContinue
    if (!(Test-Path $oldAppDir)) {
        Write-Host "✓ Successfully deleted $oldAppDir" -ForegroundColor Green
        Write-Host "✓ 已成功删除 $oldAppDir`n" -ForegroundColor Green
    } else {
        Write-Host "⚠ Could not fully delete $oldAppDir, some files may be locked" -ForegroundColor Yellow
        Write-Host "⚠ 无法完全删除 $oldAppDir，可能有文件被锁定" -ForegroundColor Yellow
    }
} else {
    Write-Host "> Directory does not exist: $oldAppDir" -ForegroundColor Gray
    Write-Host "> 目录不存在: $oldAppDir`n" -ForegroundColor Gray
}

Write-Host "Cleaning Windows registry..." -ForegroundColor Cyan
Write-Host "清理 Windows 注册表...`n" -ForegroundColor Cyan

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
        Write-Host "> 删除注册表键: $key`n" -ForegroundColor Red
        reg delete $key /f 2>$null
        if (!(Test-Path $key)) {
            Write-Host "✓ Successfully deleted registry key: $key" -ForegroundColor Green
            Write-Host "✓ 已成功删除注册表键: $key`n" -ForegroundColor Green
        } else {
            Write-Host "> Registry key does not exist or could not be deleted: $key" -ForegroundColor Gray
            Write-Host "> 注册表键不存在或无法删除: $key`n" -ForegroundColor Gray
        }
    } else {
        Write-Host "> Registry key does not exist: $key" -ForegroundColor Gray
        Write-Host "> 注册表键不存在: $key`n" -ForegroundColor Gray
    }
}

Write-Host "Cleanup completed!" -ForegroundColor Green
Write-Host "清理完成！`n" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan
Write-Host "Note: This script has cleaned the following:" -ForegroundColor Yellow
Write-Host "注意：此脚本已清理了以下内容：`n" -ForegroundColor Yellow
Write-Host "- Application data directory: $appDataDir" -ForegroundColor White
Write-Host "- 应用数据目录: $appDataDir`n" -ForegroundColor White
Write-Host "- Old application data directory: $oldAppDir" -ForegroundColor White
Write-Host "- 旧应用数据目录: $oldAppDir`n" -ForegroundColor White
Write-Host "- Related registry keys" -ForegroundColor White
Write-Host "- 相关注册表键`n" -ForegroundColor White
Write-Host "Restart Pailer to see the first-run settings." -ForegroundColor Cyan
Write-Host "重启 Pailer 以查看首次运行设置。`n" -ForegroundColor Cyan

Read-Host "Press Enter to exit / 按 Enter 键退出"
