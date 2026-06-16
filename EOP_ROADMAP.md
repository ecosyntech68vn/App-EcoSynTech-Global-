# EcoSynTech Operations Platform (EOP) — Lộ trình từ Farm OS V5

> Tầm nhìn (theo tài liệu): KHÔNG phải "phần mềm nông nghiệp" mà là **nền tảng vận hành thực địa + IoT**.
> Nguyên tắc vàng: **một lõi dữ liệu — nhiều giao diện nghiệp vụ**. Thiết kế core tổng quát NGAY → sau chỉ bật module (cafe / xưởng / HTX / kho vật tư) không viết lại.

## Kiến trúc lõi (thiết kế ngay, kể cả khi chưa dùng hết)
```
Tenant (đơn vị) → Site (Farm / Cafe / Workshop / Factory)
  ├── Item         (vật tư · thành phẩm · linh kiện · hàng hoá)  → Inventory
  ├── Asset        (máy bơm · tủ điện · gateway · PCB · xe · kho lạnh)
  ├── WorkOrder    (việc: tưới/bón/thu hoạch/hàn board/kiểm kê)
  ├── Employee     (hồ sơ · chấm công · khoán sản phẩm → lương)
  ├── FinanceEntry (chi phí · doanh thu → giá thành/lô, /kg, lợi nhuận)
  └── TraceRecord  (QR = KẾT QUẢ tổng hợp tất cả ở trên)
StockMovement: { itemId, type: import|export|transfer|count, qty, ref, ts }  ← append-only
```
Inventory/Asset/WorkOrder bản chất giống nhau giữa các ngành → chỉ khác *cấu hình loại Item* + nhãn giao diện.

## 6 Module (bật dần)
1. **Inventory** — kho: nhập/xuất/chuyển/kiểm kê/cảnh báo. (đang làm)
2. **Asset** — tài sản: serial, vị trí, bảo hành, lịch bảo trì.
3. **Work Order** — giao việc, tiến độ, checklist, ảnh hiện trường.
4. **HR Lite** — hồ sơ, chấm công, ca, công nhật, khoán sản phẩm.
5. **Finance Lite** — chi phí → giá thành/lô, /kg, lợi nhuận.
6. **Traceability** — QR tự sinh từ vật tư + người + tưới + sản lượng + chi phí + ảnh + cảm biến.

---

## LỘ TRÌNH VERSION

### v5.x — Module offline-first (LÀM NGAY khi chờ PCB V8.2, không cần backend)
- **v5.0 (đã ra)**: control client (HMAC) + traceability chuẩn (GS1/VietGAP/EU/JGAP) + nhật ký chuẩn hoá liên kết lô + nền tảng tồn kho.
- **v5.1 — Inventory đầy đủ** ⭐ *(đề xuất làm tiếp ngay)*:
  - Lõi **Item** tổng quát: vật tư (raw) + **thành phẩm (finished)** + linh kiện.
  - **StockMovement append-only**: nhập / xuất / chuyển / kiểm kê — đúng triết lý truy xuất không sửa.
  - **Thu hoạch → tự đồng bộ thành phẩm vào kho** (hook `lotStore.harvest`): tạo/cộng Item thành phẩm = sản lượng lô, gắn mã lô + QR. ← tích hợp "wow".
  - **Tự trừ vật tư** khi ghi nhật ký dùng thuốc/phân (theo liều).
- **v5.2 — Asset + Work Order**: tài sản (bảo hành/bảo trì) + giao việc/checklist/ảnh.
- **v5.3 — Finance Lite + HR Lite**: giá thành theo lô/kg + chấm công/khoán → lương.
- *(Track A — điều khiển phần cứng thật chèn vào v5.x khi PCB V8.2 về + FW9.5 có HTTP/MQTT endpoint.)*

### v6 — EOP Platform (cần backend, Track B)
- Multi-tenant cloud; **bật module theo ngành** (cafe/xưởng/HTX/kho); sync đa thiết bị; licensing per-module; phân quyền.

### v7+ — Mở rộng hệ sinh thái
- Marketplace module, AI (sâu bệnh/dự báo), kết nối đối tác/siêu thị, tài chính chuỗi cung.

---

## Khuyến nghị (đi thẳng)
1. **Thu hoạch → tồn thành phẩm: LÀM NGAY ở v5.1** — giá trị cao, công sức thấp (chỉ hook vào harvest), tạo cảm giác hệ thống liền mạch chuyên nghiệp.
2. **Quản trị NVL + thành phẩm đầy đủ: làm ngay nhưng theo LÕI TỔNG QUÁT** (Item + StockMovement), KHÔNG làm riêng cho nông nghiệp → sau bật cafe/xưởng không viết lại.
3. **WMS nâng cao** (đa kho, chuyển kho, FIFO theo lô, định giá tồn) → để v6 khi có backend.
4. Tận dụng thời gian chờ PCB: chạy **v5.1 → v5.2 → v5.3** (toàn bộ offline-first, push ra APK test liên tục).
