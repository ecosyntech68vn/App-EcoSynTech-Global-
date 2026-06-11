@echo off
REM EcoSynTech Farm OS V3.0 — Build all (debug + release + bundle)
REM Usage: scripts\build-all-v3.bat
setlocal

cd /d "%~dp0\.."

echo ============================================================
echo  EcoSynTech Farm OS V3.0 — Build pipeline
echo  versionCode 30  ·  versionName 3.0.0
echo ============================================================

echo [1/6] npm install (V3.0 dependencies)...
call npm install --no-audit --no-fund --legacy-peer-deps || goto :err

if not exist android (
    echo [2/6] Adding Android platform...
    call npx cap add android || goto :err
    echo.
    echo NOTE: New Android platform created.
    echo MERGE the following templates into android/ manually:
    echo   - android\app\src\main\AndroidManifest.xml.template
    echo   - android\app\src\main\res\xml\file_paths.xml.template
    echo   - android\app\build.gradle.snippet (versionCode 30, versionName 3.0.0)
    pause
) else (
    echo [2/6] Android platform exists, skip add.
)

echo [3/6] Vite build (V3.0)...
call npm run build || goto :err

echo [4/6] Capacitor sync...
call npx cap sync android || goto :err

echo [5/6] Gradle assemble + bundle...
cd android
call gradlew.bat assembleDebug || goto :err
call gradlew.bat assembleRelease || goto :err
call gradlew.bat bundleRelease || goto :err
cd ..

echo [6/6] Copy to dist...
if not exist dist mkdir dist
copy android\app\build\outputs\apk\debug\app-debug.apk          dist\farmos-v3.0.0-debug.apk      /Y
copy android\app\build\outputs\apk\release\app-release.apk      dist\farmos-v3.0.0-release.apk    /Y
copy android\app\build\outputs\bundle\release\app-release.aab   dist\farmos-v3.0.0-release.aab    /Y

echo.
echo ============================================================
echo  V3.0 BUILD DONE
echo ============================================================
dir dist
exit /b 0

:err
echo BUILD FAIL with code %errorlevel%
exit /b %errorlevel%
