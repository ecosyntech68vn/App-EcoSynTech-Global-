// ci-patch-android.mjs — Tự vá Android project sau `npx cap add android`.
// Chạy được cả trên CI (GitHub Actions) lẫn máy local:  node scripts/ci-patch-android.mjs
// Idempotent — chạy nhiều lần không hỏng.
// Việc nó làm:
//  1. Inject các uses-permission + queries V4 vào AndroidManifest.xml (KHÔNG ghi đè manifest gốc)
//  2. Thêm android:networkSecurityConfig + FileProvider vào <application>
//  3. Copy file_paths.xml + network_security_config.xml từ android-templates/ vào res/xml/
//  4. Set versionCode 40 / versionName "4.0.0" trong android/app/build.gradle
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MANIFEST = join(ROOT, 'android/app/src/main/AndroidManifest.xml');
const GRADLE = join(ROOT, 'android/app/build.gradle');
const RES_XML = join(ROOT, 'android/app/src/main/res/xml');
const TPL = join(ROOT, 'android-templates');

const VERSION_CODE = 40;
const VERSION_NAME = '4.0.0';

const PERMISSIONS = `
    <!-- V4.0 injected by ci-patch-android.mjs -->
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.USE_BIOMETRIC" />
    <uses-permission android:name="android.permission.USE_FINGERPRINT" />
    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <queries>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:scheme="zalo" />
        </intent>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:scheme="https" />
        </intent>
    </queries>
`;

const PROVIDER = `
        <!-- V4.0 FileProvider (OTA APK + photo) injected by ci-patch-android.mjs -->
        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="\${applicationId}.estg.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>
`;

function fail(msg) { console.error('✗ ' + msg); process.exit(1); }
function ok(msg) { console.log('✓ ' + msg); }

// ===== 1+2. Manifest =====
if (!existsSync(MANIFEST)) fail('Không thấy ' + MANIFEST + ' — chạy `npx cap add android` trước.');
let m = readFileSync(MANIFEST, 'utf8');

if (!m.includes('ci-patch-android.mjs')) {
  // inject permissions ngay trước <application
  m = m.replace(/(\s*)<application/, PERMISSIONS + '\n$1<application');
  ok('Đã inject permissions + queries vào AndroidManifest.xml');
} else {
  ok('Permissions đã có (skip)');
}

if (!m.includes('android:networkSecurityConfig')) {
  m = m.replace('<application', '<application\n        android:networkSecurityConfig="@xml/network_security_config"');
  ok('Đã thêm networkSecurityConfig vào <application>');
} else {
  ok('networkSecurityConfig đã có (skip)');
}

if (!m.includes('estg.fileprovider')) {
  m = m.replace('</application>', PROVIDER + '\n    </application>');
  ok('Đã thêm FileProvider');
} else {
  ok('FileProvider đã có (skip)');
}
writeFileSync(MANIFEST, m);

// ===== 3. res/xml =====
mkdirSync(RES_XML, { recursive: true });
for (const f of ['file_paths.xml', 'network_security_config.xml']) {
  const src = join(TPL, f);
  if (!existsSync(src)) fail('Thiếu template ' + src);
  copyFileSync(src, join(RES_XML, f));
  ok('Copied res/xml/' + f);
}

// ===== 3b. background-runner cần android-js-engine-release.aar trong app/libs =====
// (gradle search: android/app/libs/ — npm package để ở node_modules/.../src/main/libs/)
const AAR_SRC = join(ROOT, 'node_modules/@capacitor/background-runner/android/src/main/libs/android-js-engine-release.aar');
const APP_LIBS = join(ROOT, 'android/app/libs');
if (existsSync(AAR_SRC)) {
  mkdirSync(APP_LIBS, { recursive: true });
  copyFileSync(AAR_SRC, join(APP_LIBS, 'android-js-engine-release.aar'));
  ok('Copied android-js-engine-release.aar → android/app/libs/ (background-runner)');
} else {
  console.warn('⚠ Không thấy android-js-engine-release.aar trong node_modules — background-runner có thể fail');
}

// ===== 4. versionCode / versionName =====
if (!existsSync(GRADLE)) fail('Không thấy ' + GRADLE);
let g = readFileSync(GRADLE, 'utf8');
g = g.replace(/versionCode\s+\d+/, 'versionCode ' + VERSION_CODE);
g = g.replace(/versionName\s+"[^"]*"/, 'versionName "' + VERSION_NAME + '"');
writeFileSync(GRADLE, g);
ok(`build.gradle → versionCode ${VERSION_CODE}, versionName "${VERSION_NAME}"`);

// ===== 5. background-runner: Kotlin jvmTarget phải khớp Java 21 của module =====
const ROOT_GRADLE = join(ROOT, 'android/build.gradle');
if (existsSync(ROOT_GRADLE)) {
  let rg = readFileSync(ROOT_GRADLE, 'utf8');
  if (!rg.includes('V4 kotlin-jvm-target-fix')) {
    rg += `
// V4 kotlin-jvm-target-fix — background-runner build Java 21, ép Kotlin khớp
subprojects { project ->
    if (project.name == 'capacitor-background-runner') {
        project.tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
            kotlinOptions.jvmTarget = '21'
        }
    }
}
`;
    writeFileSync(ROOT_GRADLE, rg);
    ok('android/build.gradle += kotlin jvmTarget 21 cho background-runner');
  } else {
    ok('kotlin jvmTarget fix đã có (skip)');
  }
}

console.log('\n✅ Android project patched — sẵn sàng gradle build.');
