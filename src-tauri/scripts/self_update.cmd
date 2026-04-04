@echo off
setlocal EnableExtensions

set "TARGET_PID={PID}"
set "RESTART_EXE={RESTART_EXE}"
set "RUN_ID=%TARGET_PID%-%RANDOM%"
set "LOG_FILE=%TEMP%\pailer-self-update-%RUN_ID%.log"

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
  pause
  exit /b 1
)

echo Running: scoop update pailer
echo [Pailer] Running: scoop update pailer>>"%LOG_FILE%"
call scoop update pailer >>"%LOG_FILE%" 2>&1
set "UPDATE_EXIT=%ERRORLEVEL%"

echo scoop update exit code: %UPDATE_EXIT%
echo [Pailer] scoop update exit code: %UPDATE_EXIT%>>"%LOG_FILE%"
if not "%UPDATE_EXIT%"=="0" (
  echo [Pailer] ERROR: scoop update pailer failed
  echo [Pailer] ERROR: scoop update pailer failed>>"%LOG_FILE%"
  echo Log: %LOG_FILE%
  type "%LOG_FILE%"
  pause
  exit /b 1
)

echo Update finished. Restarting Pailer...
echo [Pailer] Restarting Pailer>>"%LOG_FILE%"
if not exist "%RESTART_EXE%" (
  echo [Pailer] ERROR: restart executable not found: %RESTART_EXE%
  echo [Pailer] ERROR: restart executable not found: %RESTART_EXE%>>"%LOG_FILE%"
  echo Log: %LOG_FILE%
  type "%LOG_FILE%"
  pause
  exit /b 1
)

start "" "%RESTART_EXE%" >NUL 2>&1
set "RESTART_EXIT=%ERRORLEVEL%"
if errorlevel 1 (
  echo [Pailer] ERROR: failed to restart Pailer (exit code: %RESTART_EXIT%)
  echo [Pailer] ERROR: failed to restart Pailer (exit code: %RESTART_EXIT%)>>"%LOG_FILE%"
  echo Log: %LOG_FILE%
  type "%LOG_FILE%"
  pause
  exit /b 1
)

:restart_done
echo restart exit code: %RESTART_EXIT%
echo [Pailer] restart exit code: %RESTART_EXIT%>>"%LOG_FILE%"
echo [Pailer] Self-update finished at %date% %time%
echo [Pailer] Self-update finished at %date% %time%>>"%LOG_FILE%"
echo Log: %LOG_FILE%
pause
exit /b 0
