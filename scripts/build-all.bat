@echo off
REM EcoSynTech Farm OS — Build all (debug + release + bundle)
REM Usage: scripts\build-all.bat
setlocal

cd /d "%~dp0\.."

echo ============================================================
echo  EcoSynTech Farm OS — Build pipeline
echo ============================================================

echo [1/5] npm install...
call npm install --no-audit --no-fund || goto :err

if not exist android (
    echo [2/5] Adding Android platform...
    call npx cap add android || goto :err
) else (
    echo [2/5] Android platform already exists, skip add.
)

echo [3/5] Vite build...
call npm run build || goto :err

echo [4/5] Capacitor sync...
call npx cap sync android || goto :err

echo [5/5] Gradle assemble + bundle...
cd android
call gradlew.bat assembleDebug || goto :err
call gradlew.bat assembleRelease || goto :err
call gradlew.bat bundleRelease || goto :err
cd ..

if not exist dist mkdir dist
copy android\app\build\outputs\apk\debug\app-debug.apk          dist\farmos-v1.0.0-debug.apk      /Y
copy android\app\build\outputs\apk\release\app-release.apk      dist\farmos-v1.0.0-release.apk    /Y
copy android\app\build\outputs\bundle\release\app-release.aab   dist\farmos-v1.0.0-release.aab    /Y

echo.
echo ============================================================
echo  BUILD DONE
echo ============================================================
dir dist
exit /b 0

:err
echo BUILD FAIL with code %errorlevel%
exit /b %errorlevel%
