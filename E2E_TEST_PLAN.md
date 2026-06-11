# E2E Test Plan — EcoSynTech Farm OS Mobile v1.0.0

> **Tester:** CEO (manual) hoặc QA  
> **Setup:** APK debug cài Android phone (API ≥26), WLC v6.0 chạy LAN, GAS V10.3 deploy cloud  
> **Pass criteria:** ≥18/20 PASS = GO ship.  
> **Time:** ~45 phút full suite.

---

## Setup trước test

1. WLC chạy: `cd D:\ECOSYNTECHGLOBAL2026\WebLocalCoremain && 2-CHAY.bat`
2. Note IP máy chạy WLC: `ipconfig` → ghi VD `192.168.1.100`
3. Mở browser test: `http://192.168.1.100:3000/api/health` → phải trả JSON `{ok:true}`
4. Cài `farmos-v1.0.0-debug.apk` lên phone (xem INSTALL_PHONE.md)
5. Phone + máy WLC cùng WiFi

---

## TEST SUITE — 20 cases

### Auth (3 case)

**T1 — Login PIN sai**
- Step: Mở app → URL `http://192.168.1.100:3000` → PIN `0000` → Đăng nhập
- Expect: Toast "✗ HTTP 401" hoặc "Login fail", ở lại login screen
- Auto-check: `adb logcat | grep "HTTP 401"`

**T2 — Login PIN đúng + URL local**
- Setup: Tạo farmer test trên WLC với PIN `1234` (xem WLC admin)
- Step: URL `http://192.168.1.100:3000` → PIN `1234` → Đăng nhập
- Expect: Vào Dashboard, header "📊 Sensor Dashboard"
- Evidence: Screenshot Dashboard

**T3 — Login PIN đúng + URL cloud**
- Setup: Settings → Cloud URL = GAS deployment URL
- Step: Logout → Login với mode=Cloud, PIN đúng
- Expect: Login OK, Dashboard load từ cloud
- Evidence: Banner "✓ Live"

### Sensor (3 case)

**T4 — Dashboard load zones từ WLC**
- Step: Đã login, vào tab "Sensor"
- Expect: List card zone với giá trị temp/hum/pH/EC/water
- Evidence: Screenshot có ≥1 card

**T5 — Threshold vượt → highlight đỏ**
- Setup: Bơm fake telemetry temp=40°C vào WLC qua `POST /api/sensors` test
- Step: Refresh Dashboard
- Expect: Card có border-left đỏ + animation pulse
- Evidence: Screenshot card đỏ

**T6 — Network drop → cache + banner**
- Step: Bật airplane mode → vào lại Dashboard
- Expect: Banner vàng "⚠ Offline — dữ liệu sẽ sync khi có mạng"; data hiển thị từ cache
- Evidence: Screenshot banner + card cache

### Alert (4 case)

**T7 — Open alert list**
- Setup: Tạo alert test qua `POST /api/alerts {severity:"high", message:"Test"}`
- Step: Vào tab "Alert"
- Expect: Alert hiển thị card đỏ với badge unread count = 1
- Evidence: Screenshot

**T8 — Swipe ack alert**
- Step: Click button "Ack" trên card alert
- Expect: Card biến mất + toast "✓ Đã xác nhận"
- Verify backend: `GET /api/alerts?status=acknowledged` thấy alert đó
- Evidence: Screenshot toast + curl backend

**T9 — Click alert → detail**
- (V1.0 chưa có modal detail — DEFER V1.1) 
- Mark: SKIP V1.0 → không tính vào 20

**T10 — Filter status**
- Step: Dropdown "Open" → "All"
- Expect: List có thêm alert đã ack
- Evidence: Count change

### Operation Log (4 case)

**T11 — Tạo log offline → queue**
- Step: Airplane mode → vào "Log" → fill form (Tưới, Z1, "Test offline") → Submit
- Expect: Toast "⏳ Queue offline — sẽ sync sau", recent list hiện entry với badge "Pending"
- Evidence: Screenshot pill "Pending"

**T12 — Online lại → auto sync**
- Step: Tắt airplane → đợi 30s (hoặc nhấn Settings → "↻ Sync ngay")
- Expect: Entry đổi pill thành "Synced"
- Verify backend: `GET /api/journal/manual` thấy entry mới
- Evidence: Screenshot pill "Synced" + curl

**T13 — Chụp ảnh + attach**
- Step: Form log → "📷 Chụp ảnh" → chụp → Submit
- Expect: Preview thumbnail hiện, submit OK
- Evidence: Screenshot preview

**T14 — Voice note**
- DEFER V1.1 → SKIP V1.0

### Task (3 case)

**T15 — Task list render đúng status**
- Setup: Tạo 3 task qua WLC (1 queued, 1 running, 1 completed)
- Step: Vào tab "Task"
- Expect: 3 section riêng biệt "Đang chạy / Hàng đợi / Hoàn thành" với count đúng
- Evidence: Screenshot 3 section

**T16 — Mark complete**
- Step: Click "✓ Mark complete" trên 1 task queued
- Expect: Card biến mất + toast "✓ Hoàn thành"
- Verify backend: `GET /api/tasks/:id` status="completed"
- Evidence: Screenshot + curl

**T17 — Task offline complete → queue**
- Step: Airplane mode → Mark complete → online lại
- Expect: Queue + auto sync, task ở backend update status
- Evidence: Settings → "0 entry chờ sync" sau khi online

### Settings (3 case)

**T18 — Đổi URL → test → save**
- Step: Settings → đổi URL → "Test" → "Lưu cài đặt"
- Expect: Toast "✓ Server OK" → "✓ Đã lưu"
- Evidence: 2 toast screenshot

**T19 — Auto fallback LAN→Cloud**
- Setup: Settings → mode=Auto, Cloud URL valid
- Step: Tắt WLC server → vào Dashboard
- Expect: App vẫn load (chậm hơn 5s) qua cloud, banner "✓ Live"
- Evidence: Logcat thấy `[fallback] LAN fail, trying cloud`

**T20 — Logout**
- Step: Settings → Đăng xuất → confirm
- Expect: Back về Login screen, JWT cleared
- Verify: Reopen app → vẫn ở login (không auto-login)
- Evidence: Screenshot login

---

## Scoring template

| Case | PASS/FAIL | Evidence path | Notes |
|---|---|---|---|
| T1  |   |   |   |
| T2  |   |   |   |
| T3  |   |   |   |
| T4  |   |   |   |
| T5  |   |   |   |
| T6  |   |   |   |
| T7  |   |   |   |
| T8  |   |   |   |
| T9  | SKIP (V1.1) | - | Defer modal detail |
| T10 |   |   |   |
| T11 |   |   |   |
| T12 |   |   |   |
| T13 |   |   |   |
| T14 | SKIP (V1.1) | - | Defer voice note |
| T15 |   |   |   |
| T16 |   |   |   |
| T17 |   |   |   |
| T18 |   |   |   |
| T19 |   |   |   |
| T20 |   |   |   |

**Total PASS: __/18 effective (2 skip)**

---

## Quick smoke test (5 phút) — minimum trước khi ship

Nếu CEO không có time full 20 case, chạy 5 case sống còn:

1. **T2** — Login OK
2. **T4** — Sensor load
3. **T8** — Alert ack
4. **T11+T12** — Log offline → sync (combo)
5. **T20** — Logout

5/5 PASS = ship được dạng beta. Full 20 chạy sau.

---

## Automated portion — `scripts/test-api-contract.sh`

Để test API contract (không UI), CEO có thể chạy script curl trước E2E mobile:

```bash
# Test endpoint reachability
bash scripts/test-api-contract.sh http://192.168.1.100:3000
```

Output dạng:
```
[✓] /api/health             → 200
[✓] /api/sensors/latest     → 200 (3 zones)
[✓] /api/alerts?status=open → 200 (0 alerts)
[✓] /api/tasks              → 200 (5 tasks)
[✗] /api/journal/manual     → 401 (cần auth — OK, sẽ test có token sau)
```

Pass → có nghĩa backend OK, mobile chỉ cần test UI.

---

**CHECK GATE 4 — quyết định ship**

| Kịch bản | Hành động |
|---|---|
| ≥18/18 PASS | ✅ GO → ship lên CEO phone |
| 15-17 PASS | ⚠ Conditional GO → ship debug cho CEO, fix critical trước release |
| <15 PASS | ❌ STOP → debug + re-test |
