@echo off
setlocal enabledelayedexpansion
title Parental Screen Tracker - Android APK Builder & Setup
color 0b

:MENU
cls
echo ======================================================================
echo    PARENTAL SCREEN TRACKER - ANDROID MOBILE APK BUILDER ^& SETUP
echo ======================================================================
echo.
echo  This tool helps you build, configure, and install the Android Mobile App
echo  (.apk) for real-time parental monitoring on Android smartphones.
echo.
echo  ----------------------------------------------------------------------
echo  CHOOSE AN OPTION:
echo  ----------------------------------------------------------------------
echo   [1] 🚀 Build Fresh Android APK (Cloud EAS Build - Recommended)
echo   [2] 🔑 Login / Switch Expo Account (npx eas-cli login)
echo   [3] ⚙️  Initialize / Link Project to your Expo Account (npx eas-cli init)
echo   [4] 📂 Copy Existing Compiled APK to Desktop (Instant Phone Transfer)
echo   [5] 📱 Run Mobile App Instantly with Expo Go (No APK Build Required)
echo   [6] 🌐 Open Web Dashboard in Browser (Localhost:8000)
echo   [0] ❌ Exit
echo  ----------------------------------------------------------------------
echo.

set /p choice="Enter your choice [0-6] (default is 1): "
if "%choice%"=="" set choice=1

if "%choice%"=="1" goto BUILD_APK
if "%choice%"=="2" goto EAS_LOGIN
if "%choice%"=="3" goto EAS_INIT
if "%choice%"=="4" goto COPY_APK
if "%choice%"=="5" goto RUN_EXPO_GO
if "%choice%"=="6" goto LAUNCH_DASHBOARD
if "%choice%"=="0" goto EXIT_SCRIPT

echo.
echo Invalid selection. Please choose between 0 and 6.
timeout /t 2 >nul
goto MENU

:: --------------------------------------------------------------------------
:: [1] Build Fresh Android APK
:: --------------------------------------------------------------------------
:BUILD_APK
cls
echo ======================================================================
echo   [1] BUILDING FRESH ANDROID APK WITH EAS CLOUD BUILD
echo ======================================================================
echo.
cd /d "%~dp0mobile_app"

:: Check if Node is installed
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not found in your system PATH!
    echo Please install Node.js (v18+) from https://nodejs.org
    echo.
    pause
    goto MENU
)

:: Check if node_modules exists
if not exist "node_modules\" (
    echo [*] Installing dependencies (first time setup)...
    call npm install
)

echo [*] Starting EAS Android APK Build...
echo [*] EAS will bundle the React Native code and build a standalone .apk
echo     which you can download directly to your phone.
echo.
call npx --yes eas-cli build -p android --profile preview

echo.
echo ======================================================================
echo Build process finished!
echo If your build completed successfully, download the .apk from the Expo URL
echo or QR code displayed above.
echo ======================================================================
echo.
pause
goto MENU

:: --------------------------------------------------------------------------
:: [2] Login to Expo / EAS
:: --------------------------------------------------------------------------
:EAS_LOGIN
cls
echo ======================================================================
echo   [2] LOGIN TO EXPO / EAS ACCOUNT
echo ======================================================================
echo.
cd /d "%~dp0mobile_app"
echo [*] If you don't have an Expo account yet, you can sign up for free at:
echo     https://expo.dev/signup
echo.
call npx --yes eas-cli login
echo.
call npx --yes eas-cli whoami
echo.
pause
goto MENU

:: --------------------------------------------------------------------------
:: [3] Link / Initialize Project
:: --------------------------------------------------------------------------
:EAS_INIT
cls
echo ======================================================================
echo   [3] LINK / INITIALIZE PROJECT TO YOUR EXPO ACCOUNT
echo ======================================================================
echo.
cd /d "%~dp0mobile_app"
call npx --yes eas-cli init
echo.
pause
goto MENU

:: --------------------------------------------------------------------------
:: [4] Copy Existing APK to Desktop
:: --------------------------------------------------------------------------
:COPY_APK
cls
echo ======================================================================
echo   [4] COPY PRECOMPILED APK TO DESKTOP
echo ======================================================================
echo.
set "SOURCE_APK=%~dp0server\static\downloads\ParentalScreenTracker.apk"
set "DEST_APK=%USERPROFILE%\Desktop\ParentalScreenTracker.apk"

if not exist "%SOURCE_APK%" (
    if exist "F:\ICTBD_02\soft\ParentalScreenTracker.apk" (
        set "SOURCE_APK=F:\ICTBD_02\soft\ParentalScreenTracker.apk"
    )
)

if not exist "%SOURCE_APK%" (
    echo [ERROR] Precompiled APK not found in project!
    echo Run Option [1] to build a fresh APK.
    echo.
    pause
    goto MENU
)

echo [*] Copying: %SOURCE_APK%
echo [*] To:      %DEST_APK%
copy /y "%SOURCE_APK%" "%DEST_APK%" >nul
if %ERRORLEVEL% equ 0 (
    echo.
    echo [SUCCESS] ParentalScreenTracker.apk copied to your Desktop!
    echo You can now:
    echo  1. Connect your Android phone with USB cable and transfer it.
    echo  2. Or upload it to WhatsApp / Google Drive to install on your phone.
    echo.
    explorer.exe /select,"%DEST_APK%"
) else (
    echo.
    echo [FAILED] Could not copy file to Desktop.
)
echo.
pause
goto MENU

:: --------------------------------------------------------------------------
:: [5] Run Mobile App with Expo Go
:: --------------------------------------------------------------------------
:RUN_EXPO_GO
cls
echo ======================================================================
echo   [5] LAUNCHING LIVE MOBILE APP WITH EXPO GO (TUNNEL MODE)
echo ======================================================================
echo.
echo [*] Starting Expo dev server in Tunnel mode...
echo [*] Install "Expo Go" on your Android phone from Google Play Store.
echo [*] Scan the QR code shown in the terminal with Expo Go to open the app!
echo.
cd /d "%~dp0"
call "%~dp0run_mobile_app.bat"
goto MENU

:: --------------------------------------------------------------------------
:: [6] Launch Web Dashboard
:: --------------------------------------------------------------------------
:LAUNCH_DASHBOARD
cls
echo [*] Opening Web Dashboard...
start "" "http://localhost:8000"
timeout /t 2 >nul
goto MENU

:EXIT_SCRIPT
exit /b 0
