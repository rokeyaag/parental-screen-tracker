@echo off
title Parental Screen Tracker Launcher
echo ============================================================
echo   Starting Parental Screen Tracker (PostgreSQL 16)
echo ============================================================

cd /d "%~dp0"

IF NOT EXIST ".venv" (
    echo [Setup] Creating virtual environment and installing packages...
    python -m venv .venv
    .\.venv\Scripts\python.exe -m pip install --upgrade pip
    .\.venv\Scripts\pip.exe install -r requirements.txt
)

echo [1/3] Checking Database...
.\.venv\Scripts\python.exe database.py

echo [2/3] Starting Dashboard Server in Background...
start "Screen Tracker Dashboard" /min .\.venv\Scripts\python.exe run_dashboard.py

echo [3/3] Starting Tracker Client...
start "Screen Tracker Client" /min .\.venv\Scripts\python.exe run_tracker.py

echo.
echo All services launched successfully!
echo Open your browser at: http://localhost:8000
echo.
pause
