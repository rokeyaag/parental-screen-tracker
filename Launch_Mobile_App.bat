@echo off
title Parental Screen Tracker - Mobile App Launcher
echo ===================================================================
echo     Launching Parental Screen Tracker - Mobile App
echo ===================================================================
echo.
cd /d "F:\ICTBD_02\PycharmProjects\parental-screen-tracker\mobile_app"

:: Check if server is already running on port 8081
netstat -ano | findstr :8081 | findstr LISTENING >nul
if %ERRORLEVEL% equ 0 (
    echo [*] Mobile App server is already active on http://localhost:8081
    goto OPEN_BROWSER
)

echo [*] Starting Expo Mobile Server...
start "Expo Mobile Server" /min cmd /c "npx.cmd expo start --web"

:WAIT_SERVER
echo [*] Waiting for Mobile App to initialize...
timeout /t 6 /nobreak >nul

:OPEN_BROWSER
echo [*] Opening Mobile App in Smartphone Frame Window...
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --app="http://localhost:8081" --window-size=430,920
    exit /b 0
)
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app="http://localhost:8081" --window-size=430,920
    exit /b 0
)
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app="http://localhost:8081" --window-size=430,920
    exit /b 0
)
start "" "http://localhost:8081"
exit /b 0
