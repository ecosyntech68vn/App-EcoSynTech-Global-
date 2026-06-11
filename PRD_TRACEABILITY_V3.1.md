# PRD V3.1 — MODULE TRUY XUẤT NGUỒN GỐC

> **Owner:** CEO Thuận · **Date:** 2026-06-11 · **Status:** Code-complete, build PASS
> **Định vị:** đây là module biến app từ "remote control trang trại" thành đúng lõi EcoSynTech Farm OS — truy xuất nguồn gốc làm trung tâm. 100% offline-first, không phụ thuộc backend.

## 1. Phạm vi V3.1 (2 màn mới + tích hợp 1 màn cũ)

| Màn | Chức năng | File |
|---|---|---|
| **Lô / Mùa vụ** (`lots`) | Tạo lô (cây trồng, giống, zone, diện tích, ngày xuống giống) · mã lô tự sinh · timeline append-only · thu hoạch + PHI guard · QR truy xuất · Phiếu truy xuất PDF | `src/pages/lots.js` |
| **Vật tư + PHI** (`materials`) | Danh mục phân bón/thuốc BVTV, mỗi vật tư có PHI (ngày cách ly); seed sẵn 7 vật tư phổ biến | `src/pages/materials.js` |
| **Nhật ký** (nâng cấp) | Dropdown "Lô truy xuất" — entry gắn lô đi vào chuỗi sự kiện của lô | `src/pages/log.js` |
| Data layer | `lotStore`, `materialsStore`, event log append-only, PHI engine | `src/db/trace.js` |

## 2. Nguyên tắc thiết kế (vision)

1. **Append-only evidence chain.** Sự kiện đã ghi không sửa/xoá được — không có API sửa. Đây là điều kiện cần để hồ sơ có giá trị đối chứng VietGAP/GlobalGAP và với người mua.
2. **PHI enforcement, không phải reminder.** Phun thuốc có PHI → lô bị KHOÁ thu hoạch đủ số ngày. Farmer bị chặn; manager được override nhưng hành vi override bị ghi vĩnh viễn vào hồ sơ lô và in trên phiếu truy xuất. An toàn thực phẩm là ràng buộc cứng, không phải gợi ý.
3. **Mã lô tương thích tương lai.** `EST-{farm}-{YYMMDD}-{seq}` (vd `EST-F1-260611-01`). Khi có GTIN, nâng cấp QR sang GS1 Digital Link `/01/{gtin}/10/{lot}` mà không phá dữ liệu cũ.
4. **Local-first tuyệt đối.** Tạo lô, ghi sự kiện, khoá PHI, thu hoạch, sinh QR, xuất PDF — tất cả chạy 0 network. Sự kiện gắn lô vẫn sync về `/api/journal/manual` hiện có (field mở rộng `lotId`, backend không cần đổi schema).

## 3. Luồng nghiệp vụ chuẩn

```
Tạo lô (xuống giống) → ghi hoạt động trong vụ (tưới/bón/BVTV, chọn vật tư + liều)
  → nếu thuốc có PHI: lô khoá thu hoạch N ngày (badge 🔒 PHI)
  → hết PHI → Thu hoạch (sản lượng + ngày)
  → QR truy xuất (https://trace.ecosyntech.vn/t/{maLô}) + Phiếu truy xuất PDF
     (đầy đủ tiếng Việt — render canvas, kèm QR + toàn bộ timeline)
```

## 4. Quyết định kỹ thuật

| Quyết định | Lý do |
|---|---|
| QR lib `qrcode-generator` (~10KB, 0 deps) | Frugal; render SVG in-app + vẽ canvas cho PDF |
| PDF qua canvas → jsPDF addImage | jsPDF font mặc định không có dấu tiếng Việt; canvas render Unicode chuẩn, không cần nhúng font 200KB |
| Lot data trong IndexedDB, sync flag `traceSyncEnabled` mặc định OFF | Backend WLC chưa có `/api/lots`; tránh dead-letter noise. Bật flag khi backend sẵn sàng |
| Override PHI chỉ cho manager/admin, ghi vĩnh viễn | Cân bằng thực tế vận hành (mưa bão phải thu sớm) với tính toàn vẹn hồ sơ |

## 5. Yêu cầu backend WLC V6.1 (để bật sync — không chặn V3.1)

| Endpoint | Mô tả |
|---|---|
| `POST /api/lots` | Upsert lot `{action: create|harvest, lot}` |
| `GET /api/lots?farmId=` | List lots (đối soát đa thiết bị) |
| `GET /trace/t/:code` (public, trên trace.ecosyntech.vn) | Landing page người tiêu dùng quét QR: hiện cây trồng, farm, timeline đã lược (không lộ GPS/giá) |

## 6. Roadmap truy xuất (thứ tự ưu tiên)

1. **V3.2** — Trace landing page public (1 trang tĩnh + JSON từ WLC/cloud) → QR quét ra kết quả thật. Đây là mảnh còn thiếu duy nhất để demo khách hàng end-to-end.
2. **V3.3** — Đối soát đa thiết bị (`/api/lots` + conflict rule: event log merge theo ts, lot status server-wins).
3. **V4** — GS1: GTIN cho sản phẩm, QR Digital Link, chuẩn bị EPCIS event khi khách enterprise yêu cầu. Không làm blockchain — chi phí không tạo giá trị thật ở quy mô này.

## 7. E2E test bổ sung (chạy tay trên phone, thêm vào E2E plan)

| # | Case | Pass khi |
|---|---|---|
| T1 | Tạo lô offline (airplane mode) | Lô hiện trong list, mã đúng format |
| T2 | Ghi BVTV có PHI 7d vào lô | Badge 🔒 PHI 7d, toast cảnh báo khoá |
| T3 | Thu hoạch khi còn PHI (role farmer) | Bị chặn, message rõ lý do |
| T4 | Thu hoạch khi còn PHI (manager + override) | Cho qua, hồ sơ + phiếu PDF in dòng override |
| T5 | Thu hoạch sau PHI → QR | QR hiện, quét ra URL đúng mã lô |
| T6 | Xuất phiếu PDF | Tiếng Việt đủ dấu, QR + timeline đầy đủ |
| T7 | Nhật ký (tab Log) gắn lô | Sự kiện xuất hiện trong timeline lô |
| T8 | Kill app → mở lại | Toàn bộ lô/sự kiện còn nguyên (IndexedDB) |
