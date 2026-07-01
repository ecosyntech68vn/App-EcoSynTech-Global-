# EcoSynTech Farm OS — Mobile App

> **The mobile companion app for EcoSynTech Farm OS** — A precision agriculture operating system designed for resilience, traceability, and frugal innovation. Offline-first. Made in Vietnam.

[![Release](https://img.shields.io/github/v/release/ecosyntech68vn/Farm-OS-App?label=release)](https://github.com/ecosyntech68vn/Farm-OS-App/releases)
[![Build](https://img.shields.io/github/actions/workflow/status/ecosyntech68vn/Farm-OS-App/release-android.yml?label=android%20build)](https://github.com/ecosyntech68vn/Farm-OS-App/actions)
[![Version](https://img.shields.io/badge/version-6.3.0-2ecc71.svg)](./package.json)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](#license)
[![Made in Vietnam](https://img.shields.io/badge/made_in-Vietnam-da251d.svg)](#)

---

## Hướng dẫn triển khai

Xem file [docs/HUONG_DAN_TRIEN_KHAI.md](docs/HUONG_DAN_TRIEN_KHAI.md) — hướng dẫn chi tiết bằng tiếng Việt:
- Cài đặt môi trường + chạy app
- Phát WiFi cho cả phòng dùng (không cần internet)
- Dùng từ xa qua Tailscale VPN
- Build APK Android
- Hướng dẫn sử dụng các tính năng chính

## Highlights V6.3

- **Offline-first.** Hoạt động không cần Internet — login PIN, ghi nhật ký, xem dashboard, sinh QR truy xuất, xuất phiếu PDF. Mất mạng, mất điện — app vẫn chạy.
- **Truy xuất nguồn gốc end-to-end.** Lô / mùa vụ + PHI guard (chặn thu hoạch khi chưa hết cách ly) + QR + PDF VietGAP đầy đủ tiếng Việt. Append-only evidence chain — sự kiện đã ghi không sửa được.
- **Tưới thông minh theo mùa.** Rule engine preset cho mùa khô / mùa mưa × rau ăn lá / quả / củ. 4 ô điền là chạy.
- **Aptos Blockchain.** Ghi dữ liệu truy xuất lên Aptos — không thể sửa, không thể xoá.
- **Dark mode & i18n.** Giao diện tối + Tiếng Việt / English.
- **RBAC phân quyền.** CEO → Admin → Trưởng phòng → Nhân viên.
- **Thanh toán.** MoMo / ZaloPay / VietQR.
- **Kho ERP.** Nhập – xuất – tồn + xuất CSV.
- **Dashboard dự báo.** Dự báo sản lượng theo dữ liệu mùa vụ.
- **Android-first qua Capacitor.** APK + AAB cho CH Play, build local Windows 1 lệnh.
- **Multi-tier sync.** LAN-first (WLC) → Cloud fallback (GAS) tự động, JWT auto-refresh.
- **Bảo mật V6.** Android Keystore cho JWT/PIN, xác thực PIN cũ khi đổi, RAM cache, dashboard cleanup, fix active tab, lazy seq persistence.

## Triết lý sản phẩm

> **Chuỗi ưu tiên cứng:** An toàn → Tin cậy → Khả năng phục hồi → Đơn giản → Chi phí
>
> **Frugal Innovation + Human-Centric Design** — không chạy theo công nghệ hào nhoáng. Chỉ xây những gì tạo ra giá trị thật cho nông dân Việt Nam.

Toàn bộ bundle JS gzip ~250KB. Một mình một laptop cũ vẫn build được. Một người vận hành cả trại được.

## Cấu trúc dự án

```
Farm-OS-App/
├── src/
│   ├── pages/         # 21 màn hình (login, dashboard, lots, materials, rules, scan, ...)
│   ├── stores/        # 7 store Alpine (auth, plan, secure, sync, bgsync, biometric, push)
│   ├── api/           # fallback-client (LAN ↔ Cloud, JWT refresh)
│   ├── db/            # IndexedDB + trace.js (lot/event append-only)
│   ├── components/    # Toast, reusable UI
│   ├── shims/         # Capacitor shims cho dev browser
│   └── styles/        # app.css
├── android-templates/ # Manifest + gradle template (merge sau cap add android)
├── play-store-kit/    # 9 screenshots, mô tả VI/EN, privacy policy, icon
├── trace-landing/     # QR resolution page (deploy Netlify)
├── runners/           # Background sync runner (Workmanager)
├── scripts/           # build-all.bat, gen-keystore.bat, test-api-contract.sh
└── .github/workflows/ # CI + Release Android (auto build khi push tag v*)
```

## Quick Start

### 1. Cài đặt local (dev)

```bash
git clone https://github.com/ecosyntech68vn/Farm-OS-App.git
cd Farm-OS-App
npm install
npm run dev        # mở http://localhost:5173
```

### 2. Build APK + AAB

```bat
scripts\gen-keystore.bat       :: tạo keystore lần đầu (password random)
scripts\build-all-v3.bat       :: vite build + cap sync + gradle build
```

Output: `dist/farmos-v4.0.0-debug.apk`, `-release.apk`, `-release.aab` (~14-22 MB).

> Chi tiết 7 bước: xem [BUILD_FROM_SOURCE.md](BUILD_FROM_SOURCE.md).

### 3. Cài lên phone + smoke test

Xem [INSTALL_PHONE.md](INSTALL_PHONE.md). Default PIN: `1234`. Mode default: **Local Offline**.

## Demo bán hàng (Tuyên Quang, T7)

Xem [DEMO_GUIDE_V4.md](DEMO_GUIDE_V4.md) — kịch bản pitch 7 phút theo nỗi đau khách. Có sẵn nút **Settings → Demo bán hàng → Tạo dữ liệu mẫu** để demo offline không cần backend.

## Tài liệu chính

| Document | Mục đích |
|---|---|
| [PRD_V1.md](PRD_V1.md) | Spec ban đầu V1.0 |
| [PRD_V3.md](PRD_V3.md) | Spec V3.0 — 18 features |
| [PRD_TRACEABILITY_V3.1.md](PRD_TRACEABILITY_V3.1.md) | Module truy xuất nguồn gốc |
| [SECURITY_FIXES_V3.1_2026-06-11.md](SECURITY_FIXES_V3.1_2026-06-11.md) | Hardening V3.1 — 6 critical fix |
| [BUILD_FROM_SOURCE.md](BUILD_FROM_SOURCE.md) | Build từ source 7 bước |
| [INSTALL_PHONE.md](INSTALL_PHONE.md) | Cài lên phone + smoke 8 case |
| [DEMO_GUIDE_V4.md](DEMO_GUIDE_V4.md) | Kịch bản pitch HTX 7 phút |
| [HANDOVER_REPORT_V3_2026-06-10.md](HANDOVER_REPORT_V3_2026-06-10.md) | Báo cáo handover V3 |
| [KEYSTORE_SECRETS_GUIDE.md](KEYSTORE_SECRETS_GUIDE.md) | Setup GitHub Secrets cho CI/CD |
| [E2E_TEST_PLAN_V3.md](E2E_TEST_PLAN_V3.md) | 50 case E2E test |
| [CHUAN_BI_DEMO_THU7.md](CHUAN_BI_DEMO_THU7.md) | Chuẩn bị pitch Tuyên Quang T7 |

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Mobile shell | Capacitor 6.x | Cross-platform, JS bundle nhẹ |
| UI runtime | Alpine.js 3.x | Frugal — không cần React/Vue ecosystem |
| Build | Vite 5 | Build nhanh, gzip ~250KB |
| Storage | IndexedDB + idb-keyval | Offline-first, không cần native DB |
| Secret storage | capacitor-secure-storage-plugin | Android Keystore native, fallback Preferences |
| Charts | Chart.js 4 | Bundle inline, không cần CDN |
| QR | qrcode-generator | ~10KB, 0 deps |
| PDF | jsPDF + canvas Unicode | Tiếng Việt đủ dấu, không nhúng font 200KB |
| Biometric | @aparajita/capacitor-biometric-auth | Fingerprint/Face, fallback PIN |
| Barcode scan | @capacitor-mlkit/barcode-scanning | MLKit native |
| Background | @capacitor/background-runner | Workmanager 15p, push fallback |
| Auth | PIN 4-số offline + JWT cloud | Phù hợp farmer không có email |
| Backend | WLC v6.0 (Node + SQLite LAN) + GAS V10.3.6 (Cloud) | Tách rời, fail-over tự động |

## Status V4.0

| Feature group | Status | Note |
|---|---|---|
| 24 core features (V1.0+V1.1+V1.2+V1.3) | Done | Login, sensor, alert, log+GPS, tasks, settings, push, control, schedule, chart, biometric, QR scan, weather, OTA, bgsync, multi-role, multi-farm, PDF, gallery, SOP, pest, Zalo, geofence |
| Module truy xuất nguồn gốc | Done | Lô + PHI guard + QR + PDF VietGAP, append-only |
| Smart watering rules | Done | Preset mùa khô/mưa × cây trồng |
| Tier gating (Home/Farmer/HTX/Enterprise) | Done client-side | Server enforce JWT defer V4.1 |
| Security hardening V3.1 (6 fix) | Done | Keystore, JWT, TLS, OTA verify, dead-letter, BG runner |
| Trace landing page | Code có | Cần deploy Netlify trước demo |
| CI/CD Release Android | Done | Auto build APK+AAB khi push tag `v*` |
| IoT MQTT ESP32 PCB V8 (HMAC) | Defer V4.1 | Hiện dùng REST `fallback-client.js` |
| FCM push notification | Defer V4.1 | Hiện polling 30s + background runner |
| License server verify | Defer V4.1 | Hiện client-side gating |

> Chi tiết: [V4_AUDIT_STATUS_2026-06-12.md](V4_AUDIT_STATUS_2026-06-12.md).

## Roadmap

**V4.1** (2 tuần sau khi V4.0 demo OK)
- MQTT client thật cho ESP32 PCB V8 + HMAC handshake + ack queue
- FCM push thay polling (Firebase project + WLC fan-out)
- License server JWT verify (WLC issue `{plan, features[]}`)
- Trace landing deploy Netlify + JSON từ WLC

**V4.2**
- Đối soát đa thiết bị (lot sync `/api/lots` + conflict resolution)
- AI nhận diện sâu bệnh (TFLite on-device, Frugal)
- TLS pinning + Sentry self-host

**V5**
- GS1 Digital Link QR + EPCIS event (chuẩn bị export EU)
- iOS port (Capacitor cross-platform, chỉ cần xCode)

## Testing

- **E2E plan:** [E2E_TEST_PLAN.md](E2E_TEST_PLAN.md) + [E2E_TEST_PLAN_V3.md](E2E_TEST_PLAN_V3.md) (50 case)
- **API contract:** `scripts/test-api-contract.sh`
- **CI:** auto build mỗi commit + Release Android tự build APK/AAB khi push tag `v*`

## Đóng góp

Đây là proprietary code của EcoSynTech Global. Issues / PR từ contributors mời được hoan nghênh — vui lòng liên hệ trước qua Zalo để ký NDA.

## Liên hệ

- **Founder · CEO · CTO:** David Tạ
- **Email:** kd.ecosyntech@gmail.com
- **Zalo:** 0989516698
- **Landing:** https://ecosyntech-farmos.netlify.app/

## License

© 2026 EcoSynTech Global. All rights reserved. Proprietary — không sao chép / phân phối khi chưa có văn bản cho phép.

---

**Made with care in Vietnam · Built by a solo founder + AI agents · For Vietnamese farmers.**
