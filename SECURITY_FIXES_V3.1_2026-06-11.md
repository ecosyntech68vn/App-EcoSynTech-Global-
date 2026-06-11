# SECURITY FIXES V3.1 — 2026-06-11

> **Owner:** CEO Thuận · **Scope:** 6 issue an toàn/tin cậy phát hiện trong audit 2026-06-11 · **Status:** Code-complete, build PASS (744KB / 250KB gzip)

## Tổng quan

| # | Issue | Fix | File |
|---|---|---|---|
| 1 | Keystore nằm repo root | Chuyển vào `secrets/` (gitignored), gen-keystore sinh password ngẫu nhiên | `secrets/farmos-release.jks`, `scripts/gen-keystore.bat`, `.gitignore` |
| 2 | JWT plaintext trong Preferences | SecureStorage (Android Keystore) cho token/refresh/PIN-hash, tự migrate + xoá bản plaintext | `src/stores/secure.js`, `src/stores/auth.js` |
| 3 | HTTP không TLS, không policy | Validate URL: cloud bắt buộc HTTPS, HTTP chỉ cho IP LAN private; network_security_config chặn cleartext ở tầng OS | `auth.js (validateServerUrl)`, `settings.js`, `android/.../network_security_config.xml.template`, `capacitor.config.ts` |
| 4 | OTA không verify chữ ký | Bắt buộc asset `.apk.sha256` trong release; tải → verify SHA-256 (WebCrypto) → mới lưu; lệch/thiếu = CHẶN | `src/pages/update.js` |
| 5 | Sync queue silent-drop 4xx | Dead-letter store: không mất dữ liệu, UI trong Settings (retry/export JSON/xoá), toast cảnh báo | `src/stores/sync.js`, `src/pages/settings.js` |
| 6 | Alert chết khi app bị kill | Background runner (Workmanager 15p) tự fetch `/api/alerts` + bắn notification ngoài WebView; app đẩy url/token xuống runner KV sau login/đổi settings | `runners/sync-runner.js`, `src/stores/bgsync.js`, `main.js` |

## Chi tiết hành vi mới

**#2 — Migration tự động:** lần chạy đầu V3.1, blob `auth_v3` cũ được đọc → token/refresh chuyển vào SecureStorage → blob plaintext bị xoá. PIN hash cũng chuyển từ Preferences sang SecureStorage. User không phải làm gì.

**#3 — Quy tắc URL:** `https://` luôn OK. `http://` chỉ chấp nhận hostname thuộc 192.168.x / 10.x / 172.16-31.x / localhost (kèm cảnh báo). Cloud URL http → từ chối thẳng. Tầng OS: `network_security_config.xml` mặc định chặn cleartext, whitelist IP WLC từng trại.

**#4 — Quy trình OTA mới:** release GitHub PHẢI đính kèm `farmos-vX.Y.Z-release.apk.sha256`. App: tải checksum → tải APK → SHA-256 so khớp → lưu `Documents/farmos-vX.Y.Z-verified.apk` → user cài qua Files. Thiếu checksum = nút tải không xuất hiện.

**#5 — Dead-letter:** item lỗi 4xx (trừ 408/429) sau 3 retry chuyển `deadletter:` thay vì xoá. Settings hiện danh sách + Retry tất cả / Retry từng cái / Xuất JSON ra Documents / Xoá có confirm.

**#6 — Giới hạn đã biết:** runner chỉ chạy khi mode ≠ local và token là JWT server thật (token `local-*` bị bỏ qua). Tối đa 5 notification/lần chạy. Workmanager Android không đảm bảo đúng 15p tuyệt đối (Doze mode) — đây là trade-off chấp nhận được; nâng cấp tiếp theo là FCM (cần Firebase project + backend gửi push, xem Roadmap).

## VIỆC CEO PHẢI LÀM TRƯỚC KHI BUILD/PUBLISH

1. **Keystore:** app CHƯA publish → chạy lại `scripts\gen-keystore.bat` để tạo keystore mới với password mạnh ngẫu nhiên (bản cũ dùng `changeMe123` đã lộ trong script). Xoá `secrets\farmos-release.jks` cũ trước khi chạy. Sau đó **backup thư mục `secrets\` ra 2 nơi** (USB offline + password manager). `android/app/key.properties` hiện vẫn trỏ password cũ — script gen mới sẽ tự ghi đè.
2. **`npm install`** tại repo trước khi build (có 3 dependency mới: `capacitor-secure-storage-plugin`, `qrcode-generator`, `@capacitor/background-runner@2`).
3. Sau `npx cap add android`: copy `network_security_config.xml.template` → `res/xml/network_security_config.xml` (bỏ đuôi .template) + thêm `android:networkSecurityConfig="@xml/network_security_config"` vào `<application>`.
4. **Build pipeline thêm bước sinh checksum** khi publish release:
   `certutil -hashfile farmos-v3.1.0-release.apk SHA256` → lưu dòng hex vào `farmos-v3.1.0-release.apk.sha256`, upload cùng APK.
5. Nếu trại dùng IP WLC khác `192.168.1.100` → thêm IP vào `network_security_config.xml`.

## Roadmap an toàn (chưa làm — có chủ đích)

- TLS self-signed trên WLC + certificate pinning trong network_security_config (khi WLC hỗ trợ).
- FCM push thay polling (cần Firebase + backend).
- Crash reporting (Sentry self-host, $0) — hiện vẫn mù lỗi ngoài field.
- Rate-limit PIN local (chống brute-force trên thiết bị bị mất).
