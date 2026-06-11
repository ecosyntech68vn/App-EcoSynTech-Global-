# PIN Login Fix — V3.0.1

**Date:** 2026-06-11
**Severity:** P0 — phone CEO cài V3.0 nhưng PIN nào cũng không login được.

## Root cause

App V3.0 KHÔNG có local PIN check. Mọi PIN đều phải gửi lên server qua một trong:
- `POST {url}/api/farmer/auth/verify-otp`
- `POST {url}/api/auth/login`

Cấu hình mặc định gây ra bug:
1. `authStore.url = 'http://192.168.1.100:3000'` — LAN giả định không tồn tại trên phone CEO.
2. `authStore.mode = 'lan'` — KHÔNG fallback sang Cloud, dù `cloudUrl` có hay không.
3. CEO chưa nhập Server URL thật → cả 2 fetch đều fail.
4. Toast lỗi chỉ 2.5s → CEO không kịp đọc, lại nghĩ "PIN sai".

→ Kết quả: PIN nào CEO ấn cũng "không vào được" vì code never reaches PIN comparison logic — nó chết ở network call trước đó.

Đây KHÔNG phải hardcode PIN check sai. Đây là **missing offline-first login**, mâu thuẫn với tagline "Offline-first" của chính app.

## Fix scope (V3.0.1)

### 1. `src/stores/auth.js` — offline-first PIN

- Default `mode = 'local'` (was `'lan'`)
- Thêm `seedDefaultPinIfEmpty()`: first-run lưu hash của PIN `1234` vào `Preferences` (không hardcode trong logic compare).
- Thêm `changePin(newPin)`: cập nhật hash khi user đổi PIN trong Settings.
- Thêm `_loginLocal(pin)`: SHA-256 deterministic compare với hash trong Preferences. Phát hành session token local (`local-<timestamp>-<rand>`), không phải JWT server.
- `login()`:
  - Validate format `^[0-9]{4,6}$` trước khi gọi gì.
  - Nếu `mode === 'local'` → đi thẳng local, không network.
  - Nếu `mode` khác và network fail trên cả 2 endpoint → fallback `_loginLocal()` nếu PIN đã seed. Surface error message rõ ràng.
  - Mọi fetch wrap `withTimeout(6000ms)` — fail fast thay vì treo.

### 2. `src/pages/login.js`

- Thêm option `Local (Offline) — khuyến nghị lần đầu` trong dropdown mode, đặt làm default.
- Field URL ẩn khi mode = `local`, hiện khi `lan`/`cloud`/`auto`.
- First-run banner: "PIN mặc định: **1234**. Chế độ Local không cần server. Đổi PIN trong Settings."
- Test kết nối: nếu mode `local` → báo "không cần server" thay vì fail.

### 3. `src/main.js`

- Gọi `authStore.seedDefaultPinIfEmpty()` trong `init()` để đảm bảo first-run có PIN local sẵn.

### 4. `src/components/toast.js`

- Default timeout 4000ms (info/ok), 6000ms (err) — CEO/farmer kịp đọc.
- Tap-to-dismiss.

### 5. `src/pages/settings.js`

- Block "Đổi PIN (Local)" với 2 input + button — verify match, call `authStore.changePin()`.

## Smell rules đã tuân thủ

- ❌ KHÔNG hardcode PIN `1234` trong compare logic. Chỉ seed **hash** vào Preferences một lần.
- ❌ KHÔNG dùng `Math.random()` salt — `PIN_SALT` cố định để hash deterministic.
- ✅ SHA-256 qua `crypto.subtle.digest` — chuẩn web/Capacitor.
- ✅ Token local rõ ràng prefix `local-` để code khác phân biệt với JWT server.
- ✅ Validate PIN format trước khi xử lý.

## Test trên phone CEO (workaround tạm — KHÔNG cần APK mới)

Nếu CEO không muốn chờ build APK V3.0.1:

1. Android Settings → Apps → **FarmOS** → Storage → **Clear data** (Xoá dữ liệu).
2. Mở lại app → màn Login.
3. **Vẫn ấn PIN gì cũng không vào** vì code phone hiện tại (V3.0) vẫn chưa có fix.
4. → Phải đợi APK V3.0.1.

→ **Không có workaround thật trên APK V3.0 hiện tại.** Phải build & cài V3.0.1.

## Test sau khi cài APK V3.0.1

1. Cài APK mới (sau khi CI build xong).
2. Mở app lần đầu → màn Login hiện banner vàng "PIN mặc định 1234".
3. Mode default = `Local (Offline)`. Field URL ẩn.
4. Nhập PIN `1234` → ấn Đăng nhập → vào Dashboard.
5. Vào Settings → block "Đổi PIN" → nhập PIN mới 2 lần → ấn "Đổi PIN" → toast OK.
6. Logout → login lại bằng PIN mới → OK.
7. Bonus: vào Settings → Mode = `Cloud` → URL = GAS V10.3 URL → Save → test login Cloud (cần GAS endpoint hỗ trợ verify-otp).

## File đã sửa

```
src/stores/auth.js     (97 → 209 lines)
src/pages/login.js     (rewrite render + script)
src/main.js            (+1 line trong init)
src/components/toast.js (8 → 17 lines)
src/pages/settings.js  (+block Đổi PIN + handler)
```

## Push lên GitHub — 2 cách

### Cách A — Đã có .git local + push thẳng

```bat
cd D:\ECOSYNTECHGLOBAL2026\FarmOS-Mobile
git add src/stores/auth.js src/pages/login.js src/main.js src/components/toast.js src/pages/settings.js PIN_LOGIN_FIX_V3_0_1.md
git commit -m "fix(login): seed default PIN 1234 + first-run offline-first flow [V3.0.1]"
git push origin main
git tag -a v3.0.1 -m "V3.0.1 — PIN login bug fix"
git push origin v3.0.1
```

### Cách B — Chưa init git → init + push lần đầu

```bat
cd D:\ECOSYNTECHGLOBAL2026\FarmOS-Mobile
scripts\git-init-push.bat
```

→ rồi chạy cách A.

## CI workflow trigger

- Push `main` → `.github/workflows/ci.yml` chạy Vite build + JS syntax check (~3 phút).
- Push tag `v3.0.1` → `.github/workflows/release-android.yml` build APK signed + AAB → GitHub Release tự động (~10 phút).
- Link Actions: https://github.com/ecosyntech68vn/Farm-OS-App/actions

## Stop conditions

- CI fail → đọc log → em fix YAML/script.
- Phone V3.0.1 vẫn không login → check Preferences key `auth_v3_pin` qua `chrome://inspect` hoặc Android Studio device inspector.
- PIN local sai sau khi đổi → CEO nhớ là đã đổi. Clear data về `1234`.

## Sign-off

- ✅ Root cause xác định: missing offline-first login + default config không thực tế
- ✅ Fix code 5 file, không hardcode PIN, không leak secret
- ✅ Build/CI workflow đã có sẵn (CI_CD_REPORT_2026-06-10.md)
- ⚠️ Em KHÔNG thể push git từ sandbox (không credentials) — CEO chạy 2 lệnh trên
- ⚠️ Em KHÔNG verify được runtime trên thiết bị Android — cần CEO cài APK V3.0.1 test
