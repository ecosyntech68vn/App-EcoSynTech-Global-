@echo off
REM git-sync.bat — commit + push 1 cham (dung sau khi Claude sua code)
cd /d "%~dp0\.."
git add -A
git commit -m "update %date% %time%" 2>nul
git pull origin main --rebase --autostash
git push origin main
if errorlevel 1 (
    echo PUSH FAIL — gui nguyen man hinh nay cho Claude.
    pause
    exit /b 1
)
echo.
echo ✔ PUSH OK — GitHub Actions dang build APK:
echo   https://github.com/ecosyntech68vn/Farm-OS-App/actions
pause
exit /b 0
