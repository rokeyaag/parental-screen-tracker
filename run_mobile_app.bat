@echo off
title Parental Screen Tracker - Mobile App Runner
echo ======================================================================
echo    Parental Screen Tracker - React Native Mobile App (Expo)
echo ======================================================================
echo.

cd /d "%~dp0mobile_app"

:: Automatically find active Wi-Fi IPv4 address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address" ^| findstr /v "192.168.56." ^| findstr /v "192.168.17." ^| findstr /v "192.168.222."') do (
    for /f "tokens=1" %%b in ("%%a") do (
        set "WIFI_IP=%%b"
    )
)

if "%WIFI_IP%"=="" (
    set "WIFI_IP=192.168.0.104"
)

echo Detected Local Wi-Fi IP: %WIFI_IP%
echo.
echo Choose connection mode:
echo  [1] Tunnel Mode (RECOMMENDED - Works on 4G/LTE, Wi-Fi, and bypasses router isolation)
echo  [2] LAN Mode (Uses local Wi-Fi IP: %WIFI_IP%)
echo  [3] Reset/Clear Cache ^& Start (Fixes corrupt bundler state)
echo  [4] Open in Web Browser
echo.
set /p mode="Select option [1-4] (default is 1): "

if "%mode%"=="" set mode=1

if "%mode%"=="1" (
    echo.
    echo [*] Starting Expo in TUNNEL mode...
    echo [*] Scan the QR code using Expo Go on your Android phone.
    echo.
    npx expo start --tunnel
    goto END
)

if "%mode%"=="2" (
    echo.
    echo [*] Starting Expo in LAN mode on %WIFI_IP%...
    set REACT_NATIVE_PACKAGER_HOSTNAME=%WIFI_IP%
    echo [*] Scan the QR code using Expo Go on your Android phone.
    echo.
    npx expo start --lan
    goto END
)

if "%mode%"=="3" (
    echo.
    echo [*] Clearing cache and starting in Tunnel mode...
    npx expo start --tunnel --clear
    goto END
)

if "%mode%"=="4" (
    echo.
    echo [*] Launching Web Browser mode...
    npx expo start --web
    goto END
)

:END
pause
