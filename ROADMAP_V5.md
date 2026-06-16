# FarmOS Mobile — Lộ trình V5 (v4 demo/pilot → v5 PRODUCT)

| | |
|---|---|
| **Từ** | v4.0.0 (demo bán hàng, offline-first, control = queue) |
| **Đến** | v5.0.0 (product: điều khiển phần cứng thật + truy xuất production + cloud + phát hành) |
| **Phạm vi đợt này** | Track **A + B + C + E** (D = AI sâu bệnh để đợt sau) |
| **Ngày** | 2026-06-16 |

## Quy trình làm việc (bắt buộc mỗi phase)
1. **Local**: sửa code trong repo.
2. **Test kỹ**: build sạch kiểu-CI (`npm install --legacy-peer-deps && npm run build`) + E2E checklist. (KHÔNG cài đè node_modules Windows — build kiểm thử ở bản copy Linux.)
3. **Push** nhánh `feat/v5-*` → CI `ci.yml` chạy web build.
4. Merge `main` → `debug-apk.yml` **tự build Debug APK** → cài thử điện thoại.
5. Khi ổn: tag `v5.0.0` → `release-android.yml` **build APK/AAB ký số** → Play Store internal.

Baseline đã verify: web build **xanh** (vite OK), 3 workflow CI sẵn sàng.

---

## PHASE 0 — Nền tảng & hardening (Track E khởi động)
- Bump version 4.0.0 → **5.0.0** (package.json, capacitor.config, versionCode 50).
- Code-split bundle (hiện 773KB > 500KB cảnh báo) bằng `manualChunks` → tải nhanh hơn.
- Rà bảo mật: PIN/secure-storage/biometric, secrets không lọt vào bundle, quyền Android tối thiểu.
- E2E test pass theo `E2E_TEST_PLAN_V3.md`; CI xanh cả 3 workflow.
- **Tiêu chí xong**: push main ra Debug APK cài chạy được, version hiện 5.0.0.

## PHASE 1 — Track A: Điều khiển phần cứng THẬT (PCB V8.2)
- Định nghĩa **giao thức app ↔ WLC**: MQTT topic + payload schema khớp FW9.4 (BLE fallback khi cùng mạng LAN/không cloud).
- MQTT client (Capacitor) + quản lý kết nối/last-will; `control.js`: bật/tắt 4 relay thật, đẩy rule xuống thiết bị, nhận **cảm biến realtime** → dashboard/chart.
- Hàng đợi offline → publish lại khi reconnect (tích hợp `bgsync`).
- **Tiêu chí xong**: điều khiển relay thật + xem cảm biến realtime; mất mạng vẫn queue, có lại thì đồng bộ. Test với broker mock, field-test khi PCB về.

## PHASE 2 — Track C: Truy xuất PRODUCTION
- Deploy `trace-landing` lên host thật; QR trỏ URL production ổn định.
- **Chống giả tem**: ký số bản ghi truy xuất (HMAC/khoá bất đối xứng), landing verify chữ ký.
- Phiếu PDF truy xuất chuẩn (đủ trường pháp lý/HTX).
- **Tiêu chí xong**: khách quét QR ra trang thật, tem giả bị phát hiện, xuất PDF 1 nút.

## PHASE 3 — Track B: Backend & đồng bộ cloud
- Thiết kế **API contract**; chọn hạ tầng (⚠️ **cần anh quyết**: host/DB/domain — vd Supabase/Cloudflare/VPS).
- Thay `fallback-client` bằng API client thật; sync đa thiết bị + giải xung đột; **licensing/gói theo hợp đồng** (server quyết thay vì chọn tay).
- Auth tài khoản thật song song PIN offline.
- **Tiêu chí xong**: 2 máy sync chung 1 trại; gói do server cấp; offline vẫn chạy, online tự đồng bộ.

## PHASE 4 — Phát hành v5.0.0
- Tag `v5.0.0` → APK/AAB ký số; Play Store internal track → production.

---

## V5.1 — Kho ERP (ĐÃ LÀM, 2026-06-16)
- Sổ cái nhập–xuất–tồn append-only là nguồn sự thật; tồn = Đầu kỳ + Nhập − Xuất − Chuyển; chặn âm kho.
- Form chứng từ đầy đủ (PNK/PXK, số HĐ, ngày CT, NCC/người mua, nguồn gốc, người thao tác); Kiểm kê đặt tồn thực tế.
- Tồn an toàn per-item + cảnh báo; export CSV (báo cáo tồn + sổ nhập-xuất); import CSV theo mẫu.
- **Hoãn — Import từ ẢNH (OCR hóa đơn/nhãn):** OCR offline nặng & sai số cao với hóa đơn VN → làm khi có
  backend V6 (AI đọc ảnh online), output đổ về đúng cấu trúc CSV/chứng từ hiện có. Trước mắt CSV là đường chuẩn.

---

## V5.2 — Tưới thông minh khớp Web Local v6.1 (ĐÃ LÀM)
- App = SOẠN cấu hình; WLC/bộ điều khiển = THỰC THI (fuzzy/ETo/Kc/GA chạy ở controller, KHÔNG nhồi vào điện thoại).
- 4 chế độ: `comparison` / `schedule` / `schedule_and_condition` / `crop` (ETo·Kc theo cây + giai đoạn).
- Khung giờ nhiều slot (sáng 6-9h + chiều 16-18h) ⇒ tự tránh tưới trưa nắng (không cần rule "cấm trưa" riêng).
- Ẩm min/target/max + 10 hồ sơ cây seed (khớp crop_profiles WLC).
- **THAY ĐỔI PROTOCOL/SYNC (impact):** app đổi từ `/api/rules` (cũ) sang schema web thật:
  - rule cảm biến/lịch → `POST /api/automation/rules` (body: rule_id, zone_id, trigger{type,sensor,operator,value | schedule{startHour,endHour,days} | schedule_and_condition}, action{target,command:on_for,durationSec}, constraints{windows[],maxPerDay}, cooldown_sec, priority).
  - chế độ theo cây → `POST /api/irrigation/zones` (zone_id, site_id, crop_id, relay_pin) + `POST /api/irrigation/crops` (nếu sửa ẩm). Xoá: `DELETE …/:id`.
  - Backend WLC v6.1 đã có sẵn các route này (đã đọc trong repo) → khi WLC online là chạy thẳng; offline thì app queue idempotent.
  - Cascading: WLC giữ nguyên (không sửa); GAS/firmware không ảnh hưởng (firmware vẫn nhận lệnh qua command queue / MQTT).

---

## Phụ thuộc & rủi ro
- **Phase 1** cần chốt giao thức MQTT/BLE với FW9.4 (đọc FW để khớp topic).
- **Phase 3** cần quyết hạ tầng cloud trước khi code backend — đây là phần "nặng" nhất, cần chi phí vận hành.
- Giữ nguyên triết lý v4: **offline-first, an toàn khi mất kết nối** — mọi tính năng mới phải degrade gracefully offline.
