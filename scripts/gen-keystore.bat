@echo off
REM Generate release keystore — V3.1 SECURITY HARDENED
REM FIX #1: keystore nam trong secrets\ (gitignored), password NGAU NHIEN — khong hardcode.
setlocal enabledelayedexpansion
cd /d "%~dp0\.."

if not exist secrets mkdir secrets

if exist secrets\farmos-release.jks (
    echo Keystore secrets\farmos-release.jks ALREADY EXISTS. Delete manually to regenerate.
    echo CANH BAO: neu app da publish CH Play, KHONG BAO GIO regenerate keystore.
    exit /b 1
)

set "KEYTOOL="

REM 1. Try PATH first
where keytool >nul 2>&1
if %errorlevel%==0 (
    set "KEYTOOL=keytool"
    echo Found keytool in PATH
    goto :found
)

REM 2. Android Studio JBR/JRE — use %%~P to strip quotes
for %%P in (
    "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe"
    "C:\Program Files\Android\Android Studio\jre\bin\keytool.exe"
    "%LOCALAPPDATA%\Programs\Android Studio\jbr\bin\keytool.exe"
    "%LOCALAPPDATA%\Android\Sdk\jbr\bin\keytool.exe"
    "%USERPROFILE%\AppData\Local\Programs\Android Studio\jbr\bin\keytool.exe"
) do (
    if exist "%%~P" (
        set "KEYTOOL=%%~P"
        echo Found keytool: %%~P
        goto :found
    )
)

REM 3. Standalone JDK
for %%P in (
    "C:\Program Files\Java\jdk-17\bin\keytool.exe"
    "C:\Program Files\Java\jdk-21\bin\keytool.exe"
) do (
    if exist "%%~P" (
        set "KEYTOOL=%%~P"
        echo Found keytool: %%~P
        goto :found
    )
)

REM 4. Glob Program Files\Java\*
for /d %%D in ("C:\Program Files\Java\*") do (
    if exist "%%~D\bin\keytool.exe" (
        set "KEYTOOL=%%~D\bin\keytool.exe"
        echo Found keytool: %%~D\bin\keytool.exe
        goto :found
    )
)

echo ERROR: keytool not found. Install Android Studio or JDK 17.
exit /b 1

:found
echo.
echo Generating random keystore password...
for /f "delims=" %%R in ('powershell -NoProfile -Command "-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 24 | ForEach-Object {[char]$_})"') do set "KSPASS=%%R"
if "!KSPASS!"=="" (
    echo ERROR: khong tao duoc password ngau nhien.
    exit /b 1
)

echo Generating secrets\farmos-release.jks ...
echo.

"!KEYTOOL!" -genkeypair -v ^
  -keystore secrets\farmos-release.jks ^
  -alias farmos ^
  -keyalg RSA -keysize 2048 -validity 10000 ^
  -storepass !KSPASS! -keypass !KSPASS! ^
  -dname "CN=EcoSynTech, OU=FarmOS, O=EcoSynTech Global, L=HCM, ST=HCM, C=VN"

if errorlevel 1 (
    echo Keystore gen FAIL.
    exit /b 1
)

if not exist android\app mkdir android\app
(
echo storeFile=../../secrets/farmos-release.jks
echo storePassword=!KSPASS!
echo keyAlias=farmos
echo keyPassword=!KSPASS!
) > android\app\key.properties

(
echo KEYSTORE: secrets\farmos-release.jks
echo PASSWORD: !KSPASS!
echo ALIAS: farmos
echo CREATED: %DATE% %TIME%
) > secrets\KEYSTORE_CREDENTIALS.txt

echo.
echo ============================================================
echo  KEYSTORE GENERATED: secrets\farmos-release.jks
echo  Password: trong secrets\KEYSTORE_CREDENTIALS.txt
echo  Alias: farmos
echo.
echo  BAT BUOC LAM NGAY:
echo  1. BACKUP toan bo thu muc secrets\ ra 2 noi an toan
echo     (USB offline + password manager). MAT = MAT QUYEN PHAT HANH APP.
echo  2. KHONG commit secrets\ len git (da gitignore).
echo  3. Sau khi backup, can nhac xoa KEYSTORE_CREDENTIALS.txt,
echo     chi giu password trong password manager.
echo ============================================================
exit /b 0
