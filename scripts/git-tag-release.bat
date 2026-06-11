@echo off
REM Tag + push release — trigger GitHub Actions to build APK/AAB
REM Usage: scripts\git-tag-release.bat v3.0.0
setlocal

cd /d "%~dp0\.."

if "%~1"=="" (
    echo Usage: scripts\git-tag-release.bat ^<version^>
    echo Example: scripts\git-tag-release.bat v3.0.0
    exit /b 1
)

set TAG=%~1

echo ============================================================
echo  Tag + push release: %TAG%
echo ============================================================

git tag -a %TAG% -m "Release %TAG%"
if errorlevel 1 (
    echo Tag fail — maybe already exists. Delete first:
    echo   git tag -d %TAG%
    echo   git push origin :refs/tags/%TAG%
    exit /b 1
)

git push origin %TAG%
if errorlevel 1 (
    echo Push tag fail.
    exit /b 1
)

echo.
echo ============================================================
echo  TAG PUSHED — GitHub Actions sẽ chạy build APK + AAB
echo  Track: https://github.com/ecosyntech68vn/Farm-OS-App/actions
echo  Wait ~10 phút → Release sẽ xuất hiện tại:
echo  https://github.com/ecosyntech68vn/Farm-OS-App/releases
echo ============================================================
exit /b 0
