@echo off
title Parental Screen Tracker - Mobile App Runner
echo ======================================================================
echo    Parental Screen Tracker - React Native Mobile App (Expo)
echo ======================================================================
echo.
echo Navigating to mobile_app directory...
cd /d "%~dp0mobile_app"
echo.
echo Starting Expo Metro Bundler...
echo Scan the QR code using the Expo Go app on your phone,
echo or press 'w' to open in web browser, or 'a' for Android emulator.
echo.
npx expo start
pause
