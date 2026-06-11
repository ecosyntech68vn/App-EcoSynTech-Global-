# EcoSynTech Farm OS — Mobile App PRD V3.0

> **Owner:** CEO Thuận · **Date:** 2026-06-10 · **Status:** GO (V3.0 = V1.0 + V1.1 + V1.2 + V1.3 in 1 release)  
> **Target user:** Farmer + Manager + Tech (multi-role)  
> **Stack:** Capacitor 6 + Vite + Alpine.js 3 + Chart.js + jsPDF · Android-first · Offline-first

---

## 1. Scope V3.0 — 18 features

| ID | Feature | Tier | Endpoint chính | Plugin Capacitor |
|---|---|---|---|---|
| **V1.0 carry-over (6 màn cũ)** |  |  |  |  |
| 1 | Login | V1.0 | `/api/farmer/auth/verify-otp` | preferences |
| 2 | Sensor Dashboard | V1.0 | `/api/sensors/latest` | network |
| 3 | Alert Center | V1.0 | `/api/alerts` | - |
| 4 | Operation Log | V1.0 | `/api/journal/manual` | camera |
| 5 | Task List | V1.0 | `/api/tasks` | - |
| 6 | Settings | V1.0 | (local) | preferences |
| **V1.1 — 5 MUST** |  |  |  |  |
| A | Push notification 24/7 | V1.1 | polling 30s background | local-notifications |
| B | Manual control thiết bị (2-step confirm) | V1.1 | `POST /api/devices/:id/command` | - |
| C | Camera + GPS metadata | V1.1 | (attach to log) | camera + geolocation |
| D | Schedule lịch tưới/bón | V1.1 | `/api/schedules` GET/POST/PUT/DELETE | - |
| E | Sensor chart history 24h/7d/30d | V1.1 | `GET /api/sensors/history/:type` | chart.js |
| **V1.2 — 5 NÊN CÓ** |  |  |  |  |
| F | Biometric login | V1.2 | (local + JWT cached) | biometric (community) |
| G | QR scan device link | V1.2 | (local + `/api/devices/:id`) | barcode-scanner (community) |
| H | Weather forecast | V1.2 | OpenWeather API (user key) | - |
| I | OTA APK auto-update | V1.2 | GitHub Releases API + intent install | - |
| J | Background sync 15p | V1.2 | (queue process) | background-runner |
| **V1.3 — 8 NICE** |  |  |  |  |
| K | Multi-role Farmer/Manager/Tech | V1.3 | `GET /api/rbac/permissions/check` | - |
| L | Multi-farm switcher | V1.3 | `GET /api/farms` | - |
| M | Báo cáo PDF tuần/tháng | V1.3 | (aggregate from cache) | jsPDF + share |
| N | Photo growth timeline | V1.3 | (local from log photos) | - |
| O | SOP inline help | V1.3 | static markdown bundled | - |
| P | Pest/disease log | V1.3 | `POST /api/journal/manual {activity:'pest'}` | camera |
| Q | Share alert Zalo | V1.3 | `zalo://send?text=...` | - |
| R | Geofence auto check-in | V1.3 | (local watch) | geolocation watch |

## 2. Endpoint audit verdict

| Need | WLC v6.0 | Status |
|---|---|---|
| `/api/devices/:id/command` | ✅ exists | OK (POST với body `{action, params}`) |
| `/api/schedules` | ✅ GET/POST/PUT/DELETE | OK |
| `/api/farms` | ✅ GET + `/:id/stats` | OK |
| `/api/sensors/history/:type` | ✅ exists | OK (limit max 1000) |
| `/api/rbac/permissions/check` | ✅ GET | OK |
| App OTA endpoint | ❌ NOT in WLC | → fallback **GitHub Releases API** |
| SOP content endpoint | ❌ NOT in WLC | → **bundle markdown** trong APK (offline-first) |
| Weather endpoint | ❌ NOT in WLC | → **OpenWeather** API (user key) + cache 1h |
| Zalo deeplink | N/A | → client-side `zalo://send?text=` intent |

**Verdict**: 5/8 use WLC existing, 3/8 use external/local — **KHÔNG đổi backend schema**.

## 3. Navigation V3.0

Bottom nav giữ 5 tab cũ. Thêm "More" overflow menu (☰) ở header → đẩy 12 màn mới vào.

```
Bottom nav (5):  Sensor | Alert | Log | Task | Settings
Header overflow (12): Control · Schedule · Chart · QR Scan · Weather · 
                     Report · Gallery · SOP · Pest · Multi-farm switcher · Roles · About
Floating action button: Quick Log (Camera+GPS)
```

## 4. Offline-first design (mở rộng từ V1.0)

| Feature | Offline behavior |
|---|---|
| Push notification | Local notification fallback khi server poll trả alert mới |
| Device control | Queue command với confirm, đợi online gửi |
| Camera+GPS | Lat/long stamp bằng cache last-known location nếu GPS offline |
| Schedule | Cache list, edit offline → queue PUT |
| Chart history | IndexedDB cache 30d points |
| Biometric | 100% local |
| QR scan | Decode local, link command queue offline |
| Weather | Cache 1h last successful |
| OTA check | Cache GitHub release manifest 6h |
| Background sync | Workmanager 15min, processQueue |
| Multi-role | Cache `/rbac/permissions/check` result |
| Multi-farm | Cache farms list, active farm in Preferences |
| PDF report | Generate từ IndexedDB cache, không cần network |
| Gallery | Tất cả ảnh đã trong Capacitor Filesystem |
| SOP | Bundle markdown, 0 network |
| Pest log | Same as Operation Log queue |
| Zalo share | Intent, no network |
| Geofence | Local watch + alert |

## 5. Privacy + Permission Manifest (Android)

| Permission | Lý do | Mandatory? |
|---|---|---|
| INTERNET | API call | yes |
| ACCESS_NETWORK_STATE | Offline detect | yes |
| CAMERA | Log photo + QR scan | yes (user grant) |
| ACCESS_FINE_LOCATION | GPS stamp + Geofence | optional (user grant) |
| ACCESS_BACKGROUND_LOCATION | Geofence khi background | optional (Android 10+) |
| USE_BIOMETRIC | Fingerprint/Face login | optional |
| FOREGROUND_SERVICE | Background sync worker | yes |
| POST_NOTIFICATIONS | Local notification (Android 13+) | optional |
| REQUEST_INSTALL_PACKAGES | OTA APK install | yes (V1.2) |
| READ_MEDIA_IMAGES | Gallery V1.3 (Android 13+) | optional |

## 6. Tech stack add (V3.0)

| Layer | New library | Reason |
|---|---|---|
| Chart | `chart.js` 4.x | Sensor history, frugal |
| PDF | `jspdf` 2.x | Report generate client-side |
| QR | `@capacitor-community/barcode-scanner` | Device link |
| Biometric | `@capacitor-community/biometric-auth` | Login |
| Geolocation | `@capacitor/geolocation` | GPS stamp + Geofence |
| Local notify | `@capacitor/local-notifications` | Push fallback |
| Background | `@capacitor/background-runner` | Sync worker |

Bundle estimate sau V3.0: ~150-180KB JS gzip (vẫn frugal so với 2-3MB của React Native app cũ).

## 7. Stop conditions

- Migrate IndexedDB schema từ V1.0 → V3.0 fail → KHÔNG ship, fix migration trước
- Biometric crash trên một số device → fallback PIN, không block app
- OTA download fail giữa chừng → giữ APK cũ, retry sau
- Geofence drain pin >5%/h → adaptive interval

## 8. Definition of Done V3.0

- [ ] 18 features build PASS
- [ ] Vite build <200KB JS gzip
- [ ] 50/50 E2E PASS plan ready, ≥45/50 actual khi CEO test
- [ ] APK debug + release + AAB sinh ra
- [ ] CH Play kit refresh đủ 12 file
- [ ] CEO smoke 5 màn quan trọng PASS

---

**CHECK GATE A — PRD V3 complete + endpoint verify**: ✅ PASS
- 5/8 endpoint nhu cầu có sẵn trong WLC.
- 3/8 dùng external (GitHub Releases, OpenWeather) hoặc local bundle (SOP).
- KHÔNG cần đổi backend.
