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
echo  This tool helps you build, download, and install the Android Mobile App
echo  (.apk) for real-time parental monitoring on Android smartphones.
echo.
echo  ----------------------------------------------------------------------
echo  CHOOSE AN OPTION:
echo  ----------------------------------------------------------------------
echo   [1] 🚀 Android APK Options (Download Ready APK or Start Cloud Build)
echo   [2] 🔑 Login / Switch Expo Account (eas login / whoami)
echo   [3] ⚙️  Initialize / Link Project to your Expo Account (eas init)
echo   [4] 📂 Copy Ready APK to Desktop (Instant USB/Phone Transfer)
echo   [5] 📱 Run Mobile App Instantly with Expo Go (No APK Build Required)
echo   [6] 🌐 Open Web Dashboard in Browser (http://localhost:8000)
echo   [0] ❌ Exit
echo  ----------------------------------------------------------------------
echo.

set /p choice="Enter your choice [0-6] (default is 1): "
set "choice=%choice:"=%"
set "choice=%choice: =%"
if "%choice%"=="" set choice=1

if "%choice%"=="1" goto APK_OPTIONS
if "%choice%"=="2" goto EAS_LOGIN
if "%choice%"=="3" goto EAS_INIT
if "%choice%"=="4" goto COPY_APK
if "%choice%"=="5" goto RUN_EXPO_GO
if "%choice%"=="6" goto LAUNCH_DASHBOARD
if "%choice%"=="0" goto EXIT_SCRIPT

echo.
echo Invalid selection '%choice%'. Please choose a number between 0 and 6.
timeout /t 2 >nul
goto MENU

:: --------------------------------------------------------------------------
:: [1] APK Options
:: --------------------------------------------------------------------------
:APK_OPTIONS
cls
echo ======================================================================
echo   [1] ANDROID MOBILE APK - DOWNLOAD ^& CLOUD BUILD OPTIONS
echo ======================================================================
echo.
echo [*] Connected Expo Account:
call eas.cmd whoami 2>nul
if %ERRORLEVEL% neq 0 (
    echo     Not logged in yet. Run Option [2] from the main menu to log in.
)
echo.
echo [*] Ready-to-Install APK File (.apk):
echo     - Direct Cloud Download Link:
echo       https://expo.dev/artifacts/eas/92l6kd91ePUrDBW3L0NonT5TDT3NBwaPr_YYKh1L4SM.apk
echo.
echo     - Local File on Your PC:
echo       %~dp0server\static\downloads\ParentalScreenTracker.apk (65.9 MB)
echo.
echo ----------------------------------------------------------------------
echo  Select what you want to do:
echo ----------------------------------------------------------------------
echo   [1] 📂 Quick Copy to Desktop (Fastest - Ready in 2 seconds)
echo   [2] 🌐 Download APK via Web Browser
echo   [3] ☁️  Start a Fresh Cloud Build with EAS (Compiles latest code, ~10 mins)
echo   [0] ⬅️  Back to Main Menu
echo ----------------------------------------------------------------------
echo.

set /p subchoice="Enter sub-option [0-3] (default is 1): "
set "subchoice=%subchoice:"=%"
set "subchoice=%subchoice: =%"
if "%subchoice%"=="" set subchoice=1

if "%subchoice%"=="1" goto COPY_APK
if "%subchoice%"=="2" goto BROWSER_DOWNLOAD
if "%subchoice%"=="3" goto START_EAS_BUILD
if "%subchoice%"=="0" goto MENU

echo.
echo Invalid selection. Returning to menu...
timeout /t 2 >nul
goto MENU

:BROWSER_DOWNLOAD
echo.
echo [*] Opening APK download in default browser...
start "" "https://expo.dev/artifacts/eas/92l6kd91ePUrDBW3L0NonT5TDT3NBwaPr_YYKh1L4SM.apk"
timeout /t 3 >nul
goto MENU

:START_EAS_BUILD
echo.
echo ======================================================================
echo   STARTING CLOUD EAS APK BUILD
echo ======================================================================
echo.
cd /d "%~dp0mobile_app"

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not found in system PATH!
    pause
    goto MENU
)

echo [*] Launching: eas build -p android --profile preview
echo.
call eas.cmd build -p android --profile preview

echo.
echo ======================================================================
echo EAS Build process finished!
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
echo [*] Free signup available at: https://expo.dev/signup
echo.
call eas.cmd login
echo.
call eas.cmd whoami
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
call eas.cmd init
echo.
pause
goto MENU

:: --------------------------------------------------------------------------
:: [4] Copy Existing APK to Desktop
:: --------------------------------------------------------------------------
:COPY_APK
cls
echo ======================================================================
echo   COPY PRECOMPILED APK TO DESKTOP
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
    echo [ERROR] Precompiled APK not found locally.
    echo Opening direct download in browser...
    start "" "https://expo.dev/artifacts/eas/92l6kd91ePUrDBW3L0NonT5TDT3NBwaPr_YYKh1L4SM.apk"
    pause
    goto MENU
)

echo [*] Copying: %SOURCE_APK%
echo [*] To:      %DEST_APK%
copy /y "%SOURCE_APK%" "%DEST_APK%" >nul
if %ERRORLEVEL% equ 0 (
    echo.
    echo ======================================================================
    echo [SUCCESS] ParentalScreenTracker.apk (65.9 MB) copied to your Desktop!
    echo ======================================================================
    echo You can now:
    echo  1. Connect your Android phone with USB cable and paste the file.
    echo  2. Or upload it to WhatsApp / Google Drive to install directly.
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
