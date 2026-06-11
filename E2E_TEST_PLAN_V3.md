# E2E Test Plan V3.0 — EcoSynTech Farm OS Mobile

> **50 case** (20 V1.0 + 12 V1.1 + 10 V1.2 + 8 V1.3)  
> Pass criteria: **≥45/50 PASS = GO ship V3.0**  
> Time: ~90 phút full suite, ~10 phút smoke 8 case sống còn.

---

## Setup

1. WLC v6.0 chạy LAN (target 192.168.1.100:3000)
2. GAS V10.3 deployed (cho test fallback)
3. Phone Android API ≥26 cài APK debug v3.0.0
4. WiFi cùng mạng WLC
5. Farmer test có sẵn trên WLC với PIN
6. (Optional) OpenWeather API key free trong Settings

---

## V1.0 — 20 case carry-over (xem `E2E_TEST_PLAN.md`)

T1-T20 không thay đổi. Tóm tắt:
- T1-T3 Auth (Login PIN, URL local, URL cloud)
- T4-T6 Sensor Dashboard
- T7-T10 Alert Center
- T11-T14 Operation Log (T14 SKIP — voice note V1.4)
- T15-T17 Task List
- T18-T20 Settings

**Effective: 18/18 V1.0** (T9, T14 SKIP defer).

---

## V1.1 — 12 case mới (T21-T32)

### A — Push notification (3)

**T21 — Permission request lần đầu**
- Mở app lần đầu sau install → Android prompt "Allow notifications?"
- Expect: dialog hiện, user Allow
- Evidence: screenshot prompt

**T22 — Alert mới → Local notification**
- Tạo alert mới qua WLC `POST /api/alerts`
- Đợi ≤30s
- Expect: Phone shade hiện notification "🚨 ..."
- Evidence: screenshot notification bar

**T23 — Background polling khi app minimize**
- Minimize app (Home button) → tạo alert → đợi 30s
- Expect: Notification vẫn nhận được (polling foreground service)
- Evidence: notification ảnh khi app background

### B — Device control 2-step (3)

**T24 — Confirm bước 1 + PIN bước 2**
- Vào More → Điều khiển thiết bị → Bơm ON
- Expect: Hỏi confirm step 1 → step 2 nhập PIN → toast "✓ Lệnh đã gửi"
- Verify backend: `GET /api/devices/:id/commands` thấy entry

**T25 — Huỷ ở bước 1**
- Click button → confirm "Cancel"
- Expect: Không gửi gì

**T26 — PIN sai ở bước 2**
- Nhập PIN sai → confirm
- Expect: Toast "✗ PIN sai", không gửi

### C — Camera + GPS (3)

**T27 — Chụp ảnh có GPS stamp**
- Settings allow location → vào Log → toggle GPS ON → submit
- Expect: Entry mới có dòng "📍 lat, lng"
- Evidence: screenshot entry với GPS

**T28 — GPS denied → fallback last-known**
- Deny location permission → submit log
- Expect: Submit OK, không có GPS hoặc dùng last-known

**T29 — Offline + GPS → queue đủ metadata**
- Airplane mode → submit log với GPS
- Expect: Queue chứa cả gps field

### D — Schedule (2)

**T30 — Tạo lịch tưới mới**
- More → Lịch → "+ Tạo lịch" → fill → Save
- Expect: Toast "✓ Đã lưu lịch", card mới xuất hiện
- Verify backend: `GET /api/schedules`

**T31 — Toggle ON/OFF + Delete**
- Toggle off → DELETE → verify backend không còn

### E — Chart history (1)

**T32 — Chart 24h temperature**
- More → Biểu đồ → metric=temp, range=24h → Tải
- Expect: Chart render với line + stats min/avg/max
- Evidence: screenshot chart

---

## V1.2 — 10 case mới (T33-T42)

### F — Biometric (2)

**T33 — Enable biometric**
- Settings → toggle Biometric ON → vân tay verify
- Expect: Toast "✓ Biometric ON"

**T34 — Login với vân tay**
- Logout → mở app → tap "🖐 Vân tay" → quét
- Expect: Login OK, không cần PIN

### G — QR scan (2)

**T35 — Scan QR device → hiển thị info**
- More → QR scan → quét QR `device:esp32_001`
- Expect: Card device info hiện
- Evidence: screenshot

**T36 — Scan QR lạ → báo lỗi nhẹ**
- Scan QR `abc123`
- Expect: Card "Không tìm thấy thiết bị" (không crash)

### H — Weather (2)

**T37 — Config API key → load forecast**
- Settings → paste OpenWeather key → More → Thời tiết
- Expect: List 8 forecast cards
- Evidence: screenshot

**T38 — Offline → cache 1h**
- Tắt mạng → mở Weather
- Expect: Hiển thị cache (banner "⚠ Cache 1h")

### I — OTA update (2)

**T39 — Check version → "đã mới nhất"**
- More → Cập nhật app → check
- Expect: Card "✓ Đã là phiên bản mới nhất"

**T40 — Mock GitHub Release mới → hiển thị download**
- Tạo release fake v3.0.1 trên GitHub repo test → check
- Expect: Card warn + button download

### J — Background sync (1)

**T41 — Workmanager 15min trigger**
- Submit log offline → background → đợi 15p → bật mạng
- Expect: Queue clear tự động (verify Settings → "0 entry chờ sync")
- Evidence: screenshot Settings sau 15p

**T42 — Foreground fallback**
- Trigger manual via Settings → "↻ Sync ngay"
- Expect: Process queue ngay

---

## V1.3 — 8 case mới (T43-T50)

### K — Multi-role (1)

**T43 — Role manager → thấy thêm UI admin**
- Login farmer có role=manager (test account)
- Expect: More menu có thêm section "Admin" (V1.3.1)
- (Nếu V1.3.0 chưa ship admin section → PASS conditional)

### L — Multi-farm (1)

**T44 — Switch farm**
- More → Chuyển nông trại → list 2-3 farms → tap "Chọn"
- Expect: Active farm đổi, toast "✓ Đã chọn"
- Dashboard subsequent load dữ liệu của farm mới

### M — PDF report (1)

**T45 — Generate weekly PDF**
- More → Báo cáo PDF → weekly → Tạo
- Expect: PDF file download, mở được, có 3 section
- Evidence: file PDF + screenshot trang 1

### N — Photo gallery (1)

**T46 — Gallery group by date**
- Đã có ≥3 log có ảnh ở các ngày khác nhau → More → Album
- Expect: Photos group theo ngày, grid 3-col

### O — SOP viewer (1)

**T47 — SOP irrigation**
- More → SOP → chọn "Tưới nước"
- Expect: Markdown content render (5 step)

### P — Pest log (1)

**T48 — Submit pest report severity 4**
- More → Báo sâu bệnh → fill form → severity=4 → submit
- Expect: Toast "✓ Đã lưu báo cáo", entry vào journal với activity=pest

### Q — Zalo share (1)

**T49 — Tap "Chia sẻ Zalo"**
- More → Tiện ích → Chia sẻ alert qua Zalo
- Expect: Zalo app mở (nếu cài) với text pre-filled
- Nếu chưa cài Zalo: Android fallback "Chrome can't open"

### R — Geofence (1)

**T50 — Geofence toggle + watch position**
- More → Tiện ích → toggle Geofence ON
- Expect: Quyền GPS prompt → cho phép → toast "✓ Geofence ON"
- Move outside ~50m → kiểm tra `window.lastGeo` trong DevTools console (debug APK)

---

## Scoring template

| Range | PASS / TOTAL | Note |
|---|---|---|
| T1-T20 V1.0 | __/18 (T9, T14 SKIP) | |
| T21-T32 V1.1 | __/12 | |
| T33-T42 V1.2 | __/10 | |
| T43-T50 V1.3 | __/8 | |
| **TOTAL** | **__/48 effective** | (T9, T14 V1.0 SKIP) |

**Gate**: ≥45/48 = GO. <40 = STOP fix critical.

---

## SMOKE 8 case cho CEO test tối nay (15 phút)

Nếu CEO không có time full 50, chạy 8 case xác minh V3.0 base:

1. **T2** Login OK
2. **T4** Sensor Dashboard load
3. **T22** Push notification nhận được
4. **T24** Device control 2-step gửi command
5. **T27** Log với GPS stamp
6. **T32** Chart render
7. **T45** PDF generate
8. **T48** Pest log

8/8 PASS → ship V3.0 release. 5-7 PASS → ship debug cho CEO test rộng. <5 → STOP.
