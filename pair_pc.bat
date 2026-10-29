@echo off
title Parental Screen Tracker - PC Pairing
echo ============================================================
echo   Pairing this PC/Laptop with your Mobile Main Controller
echo ============================================================
echo.
cd /d "%~dp0"

set /p code="Enter the 6-digit code shown on your Mobile App: "

if "%code%"=="" (
    echo.
    echo [!] No code entered. Exiting.
    echo.
    pause
    exit /b
)

echo.
echo [*] Submitting pairing code: %code% ...
.\.venv\Scripts\python.exe windows_client_entry.py --pair %code%

echo.
echo [*] Launching Background Tracker Client...
start "" ".\.venv\Scripts\pythonw.exe" "windows_client_entry.py" --silent

echo.
echo ============================================================
echo SUCCESS!
echo 1. This PC is now linked to your mobile!
echo 2. Background screen tracking and monitoring is now ACTIVE!
echo ============================================================
echo.
pause
