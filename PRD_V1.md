# EcoSynTech Farm OS — Mobile App PRD V1.0.0

> **Owner:** CEO Thuận · **Date:** 2026-06-10 · **Status:** GO  
> **Target user:** Farmer field (1 role duy nhất cho V1.0.0)  
> **Stack:** Capacitor 6 + Vite + Alpine.js 3 · Android-first · Offline-first  
> **Backend:** WLC v6.0 (LAN primary) + GAS V10.3 (Cloud fallback)

---

## 1. Mục tiêu

App mobile cho **Farmer ngoài đồng** thực hiện 5 việc cốt lõi nhanh nhất, offline-first, an toàn khi mất sóng. Không thêm phức tạp ngoài MVP.

Chuỗi ưu tiên cứng: **An toàn → Tin cậy → Phục hồi → Đơn giản → Chi phí.**

## 2. Non-goals (V1.0.0)

- Multi-role (admin/manager) → V1.2
- Multi-language (i18n) → V1.1
- Voice input → V1.1
- Map view → V1.2
- BLE pairing thiết bị → V1.3
- Push notification chuẩn FCM → V1.1 (V1.0 dùng polling)

## 3. 6 Màn hình MVP

### 3.1 Login
- Input: PIN 4 số + URL server (default `http://192.168.1.100:3000`)
- Button "Test connection" → ping `GET /api/health`
- Button "Đăng nhập" → `POST /api/farmer/auth/verify-otp` (PIN làm OTP)
- Save JWT + refreshToken vào Capacitor Preferences (encrypted)
- Settings cho cloud mode: URL = GAS Web App URL

### 3.2 Sensor Dashboard
- Pull `GET /api/sensors/latest` mỗi 5s khi online
- Render từng zone: card với temp/hum/pH/EC/water level
- Color code: green (OK), yellow (warning ±10%), red (critical)
- Banner "Offline — last update: X phút trước" khi mất sóng
- Pull-to-refresh

### 3.3 Alert Center
- Pull `GET /api/alerts?status=open` mỗi 10s
- Badge unread count
- Card: severity icon + zone + message + timestamp
- Swipe right → Acknowledge → `POST /api/alerts/:id/acknowledge`
- Click → detail modal
- Filter: All / Open / Acknowledged

### 3.4 Operation Log
- Form: Activity type (tưới/bón/sâu/khác) + Zone + Note + Photo (optional)
- Camera plugin Capacitor (lưu local `data/photos/`)
- Submit → IndexedDB queue → `POST /api/journal/manual` (sync khi online)
- History list: 50 entry gần nhất, badge "pending sync"
- Voice note (V1.1)

### 3.5 Task List
- Pull `GET /api/tasks?assignee=me` mỗi 30s
- Group by status: Queued / Running / Completed
- Card: title + zone + due time + priority
- Click → detail → "Mark complete" → `PATCH /api/tasks/:id {status:'completed'}`
- Offline queue cho mark complete

### 3.6 Settings
- Server URL editor + Test
- Network mode: LAN only / Cloud only / Auto (LAN→fallback Cloud 5s)
- Sync interval: 5s / 10s / 30s / Manual
- Storage usage (photos + queue)
- Clear cache button
- Logout (clear JWT)
- Version + Build number

## 4. API Contracts (đã verify trong WLC v6.0)

### Mount paths (`WebLocalCoremain/src/server/routes.js`)
| Endpoint | Mount | Source |
|---|---|---|
| `/api/health` | inline | routes.js |
| `/api/auth/login` | safeMount | routes/auth.js |
| `/api/auth/me` | safeMount | routes/auth.js |
| `/api/auth/refresh` | safeMount | routes/auth.js |
| `/api/farmer/auth/verify-otp` | safeMount | routes/farmer.js |
| `/api/sensors` | safeMount | routes/sensors.js |
| `/api/sensors/latest` | safeMount | routes/sensors.js |
| `/api/sensors/history/:type` | safeMount | routes/sensors.js |
| `/api/alerts` GET/POST | safeMount | routes/alerts.js |
| `/api/alerts/:id/acknowledge` | safeMount | routes/alerts.js |
| `/api/tasks` GET/POST | safeMount via ops-tasks | routes/ops-tasks.js |
| `/api/tasks/:id` PATCH | safeMount | routes/ops-tasks.js |
| `/api/journal/manual` POST | safeMount | routes/journal.js |
| `/api/journal/activity` POST | safeMount | routes/journal.js |

### GAS V10.3 Cloud fallback (POST action-based)
- Base URL: `https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec`
- Action `hybrid_pull` → lấy data
- Action `hybrid_push` → push event
- Action `log_data` → log telemetry
- HMAC signature required

**KHÔNG đổi schema backend.** Mobile chỉ consume API hiện có.

## 5. Auth flow

1. User nhập PIN + URL
2. App POST `/api/farmer/auth/request-otp` (nếu cần) hoặc trực tiếp `verify-otp`
3. Server trả `{accessToken, refreshToken, expiresIn, farmerId}`
4. App save vào Capacitor Preferences (Android Keystore-backed)
5. Mọi request thêm header `Authorization: Bearer {token}`
6. 401 → refresh bằng `/api/auth/refresh` → nếu fail → back Login

## 6. Offline-first design

| Layer | Mechanism |
|---|---|
| Static assets | Service Worker cache (Capacitor WebView) |
| Read API | Last-success cache trong IndexedDB (`api_cache` store) |
| Write API | Queue trong IndexedDB (`sync_queue` store) + retry exponential backoff |
| Network detect | `@capacitor/network` plugin |
| Auto-fallback | WLC LAN timeout 5s → switch GAS Cloud → on success cache result |
| Photo storage | Capacitor Filesystem `Directory.Data/photos/` |

## 7. Tech stack chọn (frugal)

| Layer | Choice | Lý do |
|---|---|---|
| Wrapper | Capacitor 6.x | Native APK, build nhỏ, không cần Expo cloud |
| Build | Vite 5 | Fast HMR dev, ES modules |
| UI | Alpine.js 3 + Tailwind-lite | Bundle <50KB, dễ debug, đồng nhất stack WLC |
| Local DB | idb-keyval + custom queue | Nhỏ gọn, không cần Dexie nặng |
| HTTP | Native fetch + retry helper | Không thêm axios |
| Camera | @capacitor/camera | Standard |
| Storage | @capacitor/preferences + @capacitor/filesystem | Standard |
| Network | @capacitor/network | Standard |

**Bundle size target:** APK < 15MB.

## 8. Risk + Tradeoff

| Risk | Mitigation |
|---|---|
| WLC IP đổi (DHCP) | Settings cho user nhập lại, scan QR config (V1.1) |
| JWT expire khi offline lâu | Refresh khi back online, prompt re-login nếu refresh fail |
| Photo lớn → queue đầy | Resize 1280px max trước save, warn khi queue >100MB |
| GAS rate limit | Auto-throttle 30s tối thiểu giữa fallback request |
| Polling drain pin | Stop polling khi app background (Capacitor App plugin) |

## 9. Stop conditions (rollback)

- APK crash >5% session → rollback về APK cũ V1.2.0 (đã có trong WLC folder)
- Sync queue mất data → STOP, debug IndexedDB schema trước khi ship tiếp
- WLC API breaking change → app báo "Server version mismatch", chặn ghi

## 10. Definition of Done V1.0.0

- [x] 6 màn hình build PASS, render OK
- [x] Offline-first verify (4 scenario tối thiểu)
- [x] APK debug + release build PASS
- [x] AAB build cho CH Play
- [x] E2E ≥18/20 test PASS
- [x] CH Play kit đủ 8 file
- [x] CEO smoke test trên phone thật PASS
- [x] HANDOVER report đầy đủ

---

**CHECK GATE 0 — PRD complete + endpoint verify**: ✅ PASS
- 14 endpoint mobile cần đều tồn tại trong WLC routes.js (verified by grep).
- GAS V10.3 fallback dùng action-based POST (đã verify trong 31_EcoSynTechApp.gs).
- Schema backend KHÔNG cần đổi.
