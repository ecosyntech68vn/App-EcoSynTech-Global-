@echo off
REM EcoSynTech Farm OS V4.0 — Build pipeline (debug TRUOC -> release sau)
REM Usage: scripts\build-all-v4.bat   (chay tu Command Prompt, KHONG can mo Android Studio)
setlocal

cd /d "%~dp0\.."

echo ============================================================
echo  EcoSynTech Farm OS V4.0 — Build pipeline
echo  versionCode 40  ·  versionName 4.0.0
echo ============================================================

echo [1/6] npm install (V4.0 dependencies)...
call npm install --no-audit --no-fund --legacy-peer-deps || goto :err

if not exist android\gradlew.bat (
    echo [2/6] Adding Android platform...
    call npx cap add android || goto :err
    echo.
    echo NOTE: Android platform vua tao. MERGE 3 template sau vao android/ roi bam phim bat ky:
    echo   - android\app\src\main\AndroidManifest.xml.template  (+ them android:networkSecurityConfig="@xml/network_security_config" vao the application)
    echo   - android\app\src\main\res\xml\file_paths.xml.template
    echo   - android\app\src\main\res\xml\network_security_config.xml.template
    echo   - android\app\build.gradle.snippet  (versionCode 40, versionName "4.0.0")
    pause
) else (
    echo [2/6] Android platform exists, skip add.
)

echo [3/6] Vite build (V4.0)...
call npm run build || goto :err

echo [4/6] Capacitor sync...
call npx cap sync android || goto :err

echo [5/6] Gradle assembleDebug (ban DEMO — uu tien)...
cd android
call gradlew.bat assembleDebug || goto :err
cd ..
if not exist dist mkdir dist
copy android\app\build\outputs\apk\debug\app-debug.apk dist\farmos-v4.0.0-debug.apk /Y
echo.
echo  ✔ DEBUG APK SAN SANG: dist\farmos-v4.0.0-debug.apk  (du de demo)
echo.

echo [6/6] Gradle release + bundle (cho CH Play — fail cung KHONG sao voi demo)...
cd android
call gradlew.bat assembleRelease && call gradlew.bat bundleRelease
cd ..
if exist android\app\build\outputs\apk\release\app-release.apk copy android\app\build\outputs\apk\release\app-release.apk dist\farmos-v4.0.0-release.apk /Y
if exist android\app\build\outputs\bundle\release\app-release.aab copy android\app\build\outputs\bundle\release\app-release.aab dist\farmos-v4.0.0-release.aab /Y

echo.
echo ============================================================
echo  V4.0 BUILD DONE — file trong thu muc dist:
echo ============================================================
dir dist
echo.
echo Cai vao dien thoai (bat USB debugging, cam cap):
echo   adb install -r dist\farmos-v4.0.0-debug.apk
exit /b 0

:err
echo BUILD FAIL with code %errorlevel%
exit /b %errorlevel%
