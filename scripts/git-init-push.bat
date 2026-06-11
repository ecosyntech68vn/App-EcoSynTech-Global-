@echo off
REM Init git + push FarmOS-Mobile to GitHub
REM Usage: scripts\git-init-push.bat
setlocal

cd /d "%~dp0\.."

set REPO_URL=https://github.com/ecosyntech68vn/Farm-OS-App.git

echo ============================================================
echo  EcoSynTech Farm OS — Init git + push to GitHub
echo  Target: %REPO_URL%
echo ============================================================
echo.

REM Check git
where git >nul 2>&1
if errorlevel 1 (
    echo ERROR: git not in PATH. Install Git for Windows: https://git-scm.com/download/win
    exit /b 1
)

REM Check if already init
if exist .git (
    echo .git already exists in this folder.
    echo Skipping init, will just commit + push.
    goto :commit
)

REM Init with separate work-tree to avoid clashing with parent ECOSYNTECHGLOBAL2026\.git
echo [1/5] git init...
git init --initial-branch=main || (echo FAIL && exit /b 1)

echo [2/5] git remote add origin...
git remote add origin %REPO_URL%

:commit
echo [3/5] git add .
git add .

echo [4/5] git commit
git commit -m "feat: FarmOS-Mobile V4.0 — plan gating + tuoi thong minh + truy xuat QR + AI pest + CI debug APK" || echo (Maybe nothing to commit, continuing...)

echo [5/5] git push origin main
echo.
echo You will be prompted for GitHub credentials.
echo - Username: ecosyntech68vn (or your GitHub username)
echo - Password: GitHub Personal Access Token (PAT) - NOT your GitHub password
echo See REPO_SETUP.md for how to create PAT.
echo.
git push -u origin main

if errorlevel 1 (
    echo.
    echo ============================================================
    echo  PUSH FAIL
    echo  Common fixes:
    echo  1. Verify repo URL: %REPO_URL%
    echo  2. Create PAT: github.com - Settings - Developer settings - Personal access tokens
    echo  3. Run again, paste PAT as password
    echo ============================================================
    exit /b 1
)

echo.
echo ============================================================
echo  PUSH SUCCESS
echo  Repo: https://github.com/ecosyntech68vn/Farm-OS-App
echo  Next step: Add 4 GitHub Secrets — see KEYSTORE_SECRETS_GUIDE.md
echo ============================================================
exit /b 0
