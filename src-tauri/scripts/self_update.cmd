@echo off
setlocal EnableExtensions

set "TARGET_PID={PID}"
set "RESTART_EXE={RESTART_EXE}"
set "TRAY_MIGRATION_ENABLED={TRAY_MIGRATION_ENABLED}"
set "RUN_ID=%TARGET_PID%-%RANDOM%"
set "LOG_FILE=%TEMP%\pailer-self-update-%RUN_ID%.log"
set "TRAY_SNAPSHOT_FILE={TRAY_SNAPSHOT_FILE}"
if "%TRAY_MIGRATION_ENABLED%"=="" set "TRAY_MIGRATION_ENABLED=1"

cd /d "%TEMP%"
title Pailer Self-Update

echo [Pailer] Self-update started at %date% %time%
echo [Pailer] Self-update started at %date% %time%>"%LOG_FILE%"
echo [Pailer] Target PID: %TARGET_PID%
echo [Pailer] Target PID: %TARGET_PID%>>"%LOG_FILE%"
echo [Pailer] Restart executable: %RESTART_EXE%
echo [Pailer] Restart executable: %RESTART_EXE%>>"%LOG_FILE%"
echo [Pailer] Working directory: %CD%
echo [Pailer] Working directory: %CD%>>"%LOG_FILE%"
echo Waiting for Pailer to exit...

:wait_for_exit
tasklist /FI "PID eq %TARGET_PID%" 2>NUL | find /I "%TARGET_PID%" >NUL
if not errorlevel 1 (
  <nul set /p "=."
  timeout /t 1 /nobreak >NUL
  goto wait_for_exit
)

echo.
echo [Pailer] Pailer process exited
echo [Pailer] Pailer process exited>>"%LOG_FILE%"

where scoop.cmd >NUL 2>&1
if errorlevel 1 (
  echo [Pailer] ERROR: scoop.cmd not found
  echo [Pailer] ERROR: scoop.cmd not found>>"%LOG_FILE%"
  echo Log: %LOG_FILE%
  echo Press any key to exit...
  pause >NUL
  exit /b 1
)

if /I "%TRAY_MIGRATION_ENABLED%"=="1" goto tray_snapshot
echo [Pailer][tray-migration] Disabled by setting, skip snapshot
echo [Pailer][tray-migration] Disabled by setting, skip snapshot>>"%LOG_FILE%"
goto tray_snapshot_done

:tray_snapshot
echo [Pailer][tray-migration] Capturing pre-update snapshot...
echo [Pailer][tray-migration] Capturing pre-update snapshot...>>"%LOG_FILE%"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='SilentlyContinue';" ^
  "$root='HKCU:\Control Panel\NotifyIconSettings';" ^
  "$snapshotPath=$env:TRAY_SNAPSHOT_FILE;" ^
  "$items=Get-ChildItem $root | ForEach-Object {" ^
  "  $props=Get-ItemProperty -Path $_.PsPath -ErrorAction SilentlyContinue;" ^
  "  $path=$props.ExecutablePath;" ^
  "  if($path -and ($path -match '(?i)\\scoop\\apps\\pailer\\')){" ^
  "    [pscustomobject]@{ SubKey=$_.PSChildName; ExecutablePath=$path; IsPromoted=$props.IsPromoted }" ^
  "  }" ^
  "} | Where-Object { $_ -ne $null };" ^
  "$json = if($items){ @($items) | ConvertTo-Json -Depth 3 } else { $null };" ^
  "if($json){ [System.IO.File]::WriteAllText($snapshotPath, $json, [System.Text.UTF8Encoding]::new($false)) }" >>"%LOG_FILE%" 2>&1
if exist "%TRAY_SNAPSHOT_FILE%" (
  echo [Pailer][tray-migration] Snapshot saved: %TRAY_SNAPSHOT_FILE%
  echo [Pailer][tray-migration] Snapshot saved: %TRAY_SNAPSHOT_FILE%>>"%LOG_FILE%"
) else (
  echo [Pailer][tray-migration] Snapshot skipped (no candidate entries)
  echo [Pailer][tray-migration] Snapshot skipped (no candidate entries)>>"%LOG_FILE%"
)

:tray_snapshot_done

echo Running: scoop update pailer
echo [Pailer] Running: scoop update pailer>>"%LOG_FILE%"
call scoop update pailer >>"%LOG_FILE%" 2>&1
if errorlevel 1 (
  echo [Pailer] ERROR: scoop update pailer failed
  echo [Pailer] ERROR: scoop update pailer failed>>"%LOG_FILE%"
  del /Q "%TRAY_SNAPSHOT_FILE%" >NUL 2>&1
  echo Log: %LOG_FILE%
  type "%LOG_FILE%"
  echo Press any key to exit...
  pause >NUL
  exit /b 1
)
echo scoop update exit code: 0
echo [Pailer] scoop update exit code: 0>>"%LOG_FILE%"

if /I not "%TRAY_MIGRATION_ENABLED%"=="1" goto tray_migration_done
if not exist "%TRAY_SNAPSHOT_FILE%" goto tray_migration_done
echo [Pailer][tray-migration] Snapshot preserved for startup apply: %TRAY_SNAPSHOT_FILE%
echo [Pailer][tray-migration] Snapshot preserved for startup apply: %TRAY_SNAPSHOT_FILE%>>"%LOG_FILE%"

:tray_migration_done

echo Update finished. Restarting Pailer...
echo [Pailer] Restarting Pailer>>"%LOG_FILE%"
if not exist "%RESTART_EXE%" (
  echo [Pailer] ERROR: restart executable not found: %RESTART_EXE%
  echo [Pailer] ERROR: restart executable not found: %RESTART_EXE%>>"%LOG_FILE%"
  echo Log: %LOG_FILE%
  type "%LOG_FILE%"
  echo Press any key to exit...
  pause >NUL
  exit /b 1
)

start "" "%RESTART_EXE%" >NUL 2>&1
if errorlevel 1 (
  echo [Pailer] ERROR: failed to restart Pailer (exit code: %ERRORLEVEL%)
  echo [Pailer] ERROR: failed to restart Pailer (exit code: %ERRORLEVEL%)>>"%LOG_FILE%"
  echo Log: %LOG_FILE%
  type "%LOG_FILE%"
  echo Press any key to exit...
  pause >NUL
  exit /b 1
)

:restart_done
echo restart exit code: 0
echo [Pailer] restart exit code: 0>>"%LOG_FILE%"
echo [Pailer] Self-update finished at %date% %time%
echo [Pailer] Self-update finished at %date% %time%>>"%LOG_FILE%"
echo Log: %LOG_FILE%
echo Press any key to exit...
pause >NUL
exit /b 0
