# DEMO GUIDE V4.0 — KỊCH BẢN BÁN HÀNG (Tuyên Quang, thứ 7)

> Mục tiêu: demo trên 1 điện thoại, KHÔNG cần mạng, không cần server — chốt khách tại bàn.

## 1. Chuẩn bị trước khi đi (1 lần, ~15 phút)

```bat
cd D:\ECOSYNTECHGLOBAL2026\FarmOS-Mobile
npm install
scripts\build-all-v3.bat   (hoặc: npm run android:debug)
```
Cài APK vào điện thoại → mở app → login PIN `1234` (mode Local) → **Settings → Demo bán hàng → ＋ Tạo dữ liệu mẫu**.

Kiểm tra trước: More → Lô/Mùa vụ thấy 2 lô (1 ✓ đã thu hoạch, 1 🔒 PHI). Đổi PIN nếu đưa máy cho khách cầm.

## 2. Kịch bản demo 7 phút (theo nỗi đau khách)

| Bước | Thao tác | Câu chốt |
|---|---|---|
| 1. Mở màn | Login offline → dashboard | "Mất mạng, mất điện — app vẫn chạy. Trại trên đồi Tuyên Quang không cần lo sóng yếu." |
| 2. Truy xuất | More → Lô/Mùa vụ → lô Rau muống ✓ → cuộn timeline | "Mỗi lần tưới, bón, phun thuốc — máy tự ghi, ghi rồi KHÔNG sửa được. Đây là thứ siêu thị và người mua cần." |
| 3. **Wow moment** | Bấm QR → đưa khách tự quét bằng máy CỦA HỌ | Khách thấy trang truy xuất thương hiệu EcoSynTech hiện đúng hồ sơ lô. "Tem này dán lên bó rau của anh/chị." |
| 4. An toàn | Mở lô Cà chua 🔒 → thử bấm thu hoạch | "Vừa phun thuốc nấm — app KHOÁ thu hoạch 12 ngày. Hệ thống không cho bán rau còn tồn dư thuốc. Cái này bảo vệ chính uy tín nhà mình." |
| 5. Điều khiển | More → **Tưới thông minh** → chọn mẫu "Mùa khô · Rau ăn lá" → Áp dụng | "Chọn mùa, chọn cây — máy tự điền ngưỡng chuẩn. Bộ điều khiển ở trại tự chạy, điện thoại tắt vẫn tưới. Sắp tới AI nhận diện sâu bệnh về máy miễn phí qua bản cập nhật — máy anh/chị mua hôm nay dùng trọn đời phần mềm." |
| 6. Phiếu PDF | Lô đã thu hoạch → Xuất phiếu truy xuất | "Hồ sơ giấy cho HTX / thương lái — 1 nút." |
| 7. Chốt giá | Settings → đổi gói Home→Farmer→HTX cho khách thấy khác biệt | "Gói Farmer 4.999.000 trọn bộ + 99k/tháng truy xuất. **10 suất tiên phong: giảm 10% còn 4.499.000 + miễn phí 3 tháng truy xuất** — anh/chị là suất số ___." |

## 3. Câu hỏi khách hay hỏi — trả lời chuẩn

- **"Mất mạng thì sao?"** → Tắt wifi ngay trước mặt khách, tạo 1 nhật ký mới → vẫn lưu, hiện "chờ sync". Bật lại → tự đồng bộ.
- **"Ngừng đóng 99k thì mất hết à?"** → Không. Máy vẫn chạy, dữ liệu vẫn còn, tem đã phát hành vẫn quét được. Chỉ ngừng tạo tem mới + sync cloud.
- **"Tôi không rành công nghệ"** → Demo bước 5: tạo rule chỉ 4 ô điền. "Thiết kế để một người làm được hết."
- **"Đắt không?"** → Mở bảng giá: "Một vụ rau bán được giá hơn 10-15% nhờ tem truy xuất là hoà vốn phần cứng."

## 4. Sau demo — ghi đơn

Khách gật → ghi: tên, SĐT/Zalo, gói, suất tiên phong số mấy, hẹn ngày lắp. Khách lăn tăn → xin Zalo, gửi link trang truy xuất demo (`?demo=1`) + bảng giá.

## 5. Giới hạn V4.0 cần biết (không nói quá với khách)

- Điều khiển thiết bị/rule cần bộ WLC tại trại (giao khi lắp đặt) — demo offline chỉ cho thấy giao diện + queue.
- Gói trong app đang chọn tay (demo); khi lắp thật, server quyết định gói theo hợp đồng.
- Trace landing cần deploy (5 phút, `trace-landing/DEPLOY.md`) — **làm TRƯỚC thứ 7** để bước 3 quét ra trang thật.
