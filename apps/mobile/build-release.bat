@echo off
REM ====================================
REM G88 Android Production Build Script
REM Run from apps/mobile (package.json + android\)
REM ====================================

setlocal enabledelayedexpansion

echo ========================================
echo    G88 Production Build Script
echo ========================================
echo.

REM Must run from apps/mobile
if not exist "package.json" (
    echo [ERROR] package.json not found!
    echo Please run this script from apps/mobile.
    pause
    exit /b 1
)

REM Check gradle.properties
if not exist "android\gradle.properties" (
    echo [ERROR] gradle.properties not found!
    echo Please create android\gradle.properties with your signing config.
    pause
    exit /b 1
)

REM Check if keystore is configured
findstr /C:"YOUR_STORE_PASSWORD_HERE" "android\gradle.properties" >nul
if %errorlevel% equ 0 (
    echo [ERROR] Release keystore not configured!
    echo.
    echo Please update android\gradle.properties with your keystore credentials.
    echo.
    echo Generate keystore with:
    echo   cd android\app
    echo   keytool -genkeypair -v -storetype PKCS12 -keystore release.keystore ^
    echo     -alias your-app-key -keyalg RSA -keysize 2048 -validity 10000
    pause
    exit /b 1
)

REM Build menu
echo Select build type:
echo   1) APK (for direct installation/testing)
echo   2) AAB (for Play Store upload) [RECOMMENDED]
echo   3) Both APK and AAB
echo   4) Clean build cache only
echo.
set /p choice="Enter choice [1-4]: "

REM Clean build function
if "%choice%"=="4" goto :clean_only
if "%choice%"=="1" goto :build_apk_flow
if "%choice%"=="2" goto :build_aab_flow
if "%choice%"=="3" goto :build_both_flow
goto :invalid_choice

:clean_only
echo.
echo [INFO] Cleaning build cache...
cd android
call gradlew.bat clean
if %errorlevel% neq 0 (
    echo [ERROR] Clean failed!
    cd ..
    pause
    exit /b 1
)
cd ..
echo [SUCCESS] Build cache cleaned
goto :end

:build_apk_flow
call :clean_build
call :build_apk
goto :show_summary

:build_aab_flow
call :clean_build
call :build_aab
goto :show_summary

:build_both_flow
call :clean_build
call :build_apk
call :build_aab
goto :show_summary

:clean_build
echo.
echo [INFO] Cleaning build cache...
cd android
call gradlew.bat clean
if %errorlevel% neq 0 (
    echo [ERROR] Clean failed!
    cd ..
    pause
    exit /b 1
)
cd ..
echo [SUCCESS] Build cache cleaned
exit /b 0

:build_apk
echo.
echo [INFO] Building Release APK...
cd android
call gradlew.bat assembleRelease
if %errorlevel% neq 0 (
    echo [ERROR] APK build failed!
    cd ..
    pause
    exit /b 1
)
cd ..
echo [SUCCESS] APK built successfully!
echo Location: android\app\build\outputs\apk\release\app-release.apk
for %%A in ("android\app\build\outputs\apk\release\app-release.apk") do echo Size: %%~zA bytes
exit /b 0

:build_aab
echo.
echo [INFO] Building Release AAB (App Bundle)...
cd android
call gradlew.bat bundleRelease
if %errorlevel% neq 0 (
    echo [ERROR] AAB build failed!
    cd ..
    pause
    exit /b 1
)
cd ..
echo [SUCCESS] AAB built successfully!
echo Location: android\app\build\outputs\bundle\release\app-release.aab
for %%A in ("android\app\build\outputs\bundle\release\app-release.aab") do echo Size: %%~zA bytes
echo.
echo Next Steps:
echo   1. Go to Google Play Console: https://play.google.com/console
echo   2. Select your app
echo   3. Go to Production ^> Create new release
echo   4. Upload: app-release.aab
echo   5. Fill in release notes and submit
exit /b 0

:show_summary
echo.
echo ========================================
echo Build completed successfully!
echo ========================================
echo.
echo Important Reminders:
echo   - Increment versionCode for each Play Store release
echo   - Update versionName for user-facing version (e.g., 1.0.1)
echo   - Test on multiple devices before submitting
echo   - Never commit your keystore or gradle.properties with passwords
goto :end

:invalid_choice
echo [ERROR] Invalid choice!
pause
exit /b 1

:end
echo.
pause
