@echo off
REM Alternative push method — restore from prebuilt git bundle, then push
REM Usage: scripts\git-push-from-bundle.bat
REM Useful when CEO can't init git fresh (file permission issues, etc.)
setlocal

cd /d "%~dp0\.."

set REPO_URL=https://github.com/ecosyntech68vn/Farm-OS-App.git
set BUNDLE=dist\farmos-v3.0.0.bundle

if not exist %BUNDLE% (
    echo ERROR: %BUNDLE% not found.
    echo This bundle was prepared by Claude in /tmp during build.
    echo Use scripts\git-init-push.bat instead.
    exit /b 1
)

echo ============================================================
echo  Push V3.0 from prebuilt git bundle
echo ============================================================

if not exist .git (
    echo [1/3] Clone from bundle...
    REM Clone into a temp side folder then move .git
    git clone %BUNDLE% .farmos-temp || (echo FAIL && exit /b 1)
    move .farmos-temp\.git .git
    rmdir /s /q .farmos-temp
)

echo [2/3] Set remote origin %REPO_URL%
git remote remove origin 2>nul
git remote add origin %REPO_URL%

echo [3/3] Push origin main
echo You will be prompted for GitHub credentials.
echo - Username: ecosyntech68vn
echo - Password: GitHub Personal Access Token (PAT)
git push -u origin main

if errorlevel 1 (
    echo PUSH FAIL. Common: PAT missing/expired.
    exit /b 1
)

echo PUSH SUCCESS.
echo Next: scripts\git-tag-release.bat v3.0.0
exit /b 0
