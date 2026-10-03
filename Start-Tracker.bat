@echo off
title Parental Screen Tracker - One-Click Launcher
echo ======================================================================
echo    Parental Screen Tracker - Starting Background Client...
echo ======================================================================
echo.

set BASE_DIR=%~dp0
set PYTHONW="%BASE_DIR%.venv\Scripts\pythonw.exe"
set SCRIPT="%BASE_DIR%windows_client_entry.py"

if exist %PYTHONW% (
    start "" %PYTHONW% %SCRIPT%
    echo [OK] Parental Screen Tracker is now running silently in the background!
    echo Windows Smart App Control allows this because pythonw is digitally signed.
    echo The tracker will also automatically launch on Windows startup.
) else (
    echo [ERROR] Virtual environment pythonw not found at %PYTHONW%
)

echo.
timeout /t 4
