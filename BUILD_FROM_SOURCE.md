# BUILD APK + AAB từ source — EcoSynTech Farm OS Mobile

> CEO chạy trên máy Windows đã cài Node + Android Studio.
> Time tổng: ~10 phút lần đầu (download dependencies), ~2 phút lần sau.

## 0. Prerequisites (kiểm tra 1 lần)

```bat
node --version    REM cần >=18
npm --version
java -version     REM cần JDK 17 (Android Studio kèm)
echo %ANDROID_HOME%   REM C:\Users\<user>\AppData\Local\Android\Sdk
```

Nếu thiếu Android Studio:
1. Download: https://developer.android.com/studio
2. Cài "Android SDK" + "Android SDK Build-Tools" + "Android SDK Platform 34"
3. Set ANDROID_HOME env var.

## 1. Install dependencies

```bat
cd D:\ECOSYNTECHGLOBAL2026\FarmOS-Mobile
npm install
```

Lần đầu mất ~3-5 phút (download Capacitor + Vite + plugins, tổng ~150MB).

## 2. Init Android platform (chỉ làm 1 lần)

```bat
npm run cap:add:android
```

Lệnh này tạo folder `android/` với Android Studio project chuẩn. Sau khi có rồi không cần chạy lại.

## 3. Build APK debug (nhanh nhất, ~2 phút)

```bat
npm run android:debug
```

Equivalent: `npm run build && npx cap sync android && cd android && gradlew assembleDebug`

Output: `android\app\build\outputs\apk\debug\app-debug.apk`

Copy ra `dist/`:
```bat
copy android\app\build\outputs\apk\debug\app-debug.apk dist\farmos-v1.0.0-debug.apk
```

## 4. Build APK release (signed, để cài user thật)

### 4.1 Tạo keystore (CHỈ 1 LẦN) — V3.1: dùng script, KHÔNG hardcode password

```bat
scripts\gen-keystore.bat
```

→ Output: `secrets\farmos-release.jks` + password ngẫu nhiên trong `secrets\KEYSTORE_CREDENTIALS.txt`. Script tự ghi `android/app/key.properties`.

**⚠️ QUAN TRỌNG**: keystore này CỐ ĐỊNH cho toàn bộ vòng đời app. Đổi keystore = app không update được. CEO BACKUP thư mục `secrets\` ra 2 nơi (USB offline + password manager). Thư mục `secrets\` đã gitignore — TUYỆT ĐỐI không commit.

### 4.2 Signing config

`android/app/key.properties` (script 4.1 đã tự tạo):
```
storeFile=../../secrets/farmos-release.jks
storePassword=<random từ script>
keyAlias=farmos
keyPassword=<random từ script>
```

Mở `android/app/build.gradle`, thêm vào trước `android {`:
```gradle
def keystorePropertiesFile = rootProject.file("app/key.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

Trong block `android {`, thêm:
```gradle
signingConfigs {
    release {
        keyAlias keystoreProperties['keyAlias']
        keyPassword keystoreProperties['keyPassword']
        storeFile file(keystoreProperties['storeFile'])
        storePassword keystoreProperties['storePassword']
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
    }
}
```

### 4.3 Build release APK

```bat
npm run android:release
copy android\app\build\outputs\apk\release\app-release.apk dist\farmos-v1.0.0-release.apk
```

## 5. Build AAB cho CH Play

```bat
npm run android:bundle
copy android\app\build\outputs\bundle\release\app-release.aab dist\farmos-v1.0.0-release.aab
```

## 6. Verify output

```bat
dir dist
REM Sẽ có 3 file:
REM   farmos-v1.0.0-debug.apk      (~10-15MB)
REM   farmos-v1.0.0-release.apk    (~8-12MB)
REM   farmos-v1.0.0-release.aab    (~8-12MB)
```

Optional: kiểm tra APK metadata:
```bat
"%ANDROID_HOME%\build-tools\34.0.0\aapt" dump badging dist\farmos-v1.0.0-release.apk | findstr "package versionCode versionName"
```

Phải thấy:
```
package: name='vn.ecosyntech.farmos' versionCode='1' versionName='1.0.0'
```

## 7. Troubleshoot

| Lỗi | Fix |
|---|---|
| `gradlew not found` | Chưa chạy `npx cap add android` |
| `SDK location not found` | Thiếu `ANDROID_HOME` env var |
| `Cleartext HTTP traffic not permitted` | Đã fix sẵn trong `capacitor.config.ts` (cleartext:true) |
| `Could not resolve dependency com.capacitorjs:*` | Chạy `npx cap sync android` lại |
| Build chậm | Thêm `--offline` sau lần build đầu |
| Keystore sai password | Đổi password trong `key.properties`, không đổi keystore |

## 8. Quick reference — 1-liner build all

```bat
npm install && npm run cap:add:android && npm run android:debug && npm run android:release && npm run android:bundle
```

(Sau khi đã có keystore + signing config.)
