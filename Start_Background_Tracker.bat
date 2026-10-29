@echo off
title Parental Screen Tracker - Start Background Monitor
echo ============================================================
echo   Starting Parental Screen Tracker Background Service
echo ============================================================
echo.
cd /d "%~dp0"

echo [*] Registering Windows Startup autostart...
.\.venv\Scripts\python.exe windows_client_entry.py --install

echo [*] Starting tracker silently in background...
start "" ".\.venv\Scripts\pythonw.exe" "windows_client_entry.py" --silent

echo.
echo ============================================================
echo [OK] Background screen tracking is now RUNNING!
echo - Screenshots will be captured every 15 seconds.
echo - Screen status will update on your Mobile App automatically.
echo ============================================================
echo.
timeout /t 5
