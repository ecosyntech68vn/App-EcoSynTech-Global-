# Hướng Dẫn Sử Dụng EcoSynTech Farm OS — Từ A đến Z

> Dành cho: Chủ trang trại, quản lý HTX, nông dân, nhân viên  
> Phiên bản: V6.3.0  
> **PIN mặc định:** `1234`

---

## Mục lục

1. [Đăng nhập & Màn hình chính](#1-đăng-nhập--màn-hình-chính)
2. [Dashboard — Theo dõi tổng quan](#2-dashboard--theo-dõi-tổng-quan)
3. [Quản lý Vườn / Lô](#3-quản-lý-vườn--lô)
4. [Vật tư — Nhập Xuất Tồn Kho](#4-vật-tư--nhập-xuất-tồn-kho)
5. [Tưới Thông Minh](#5-tưới-thông-minh)
6. [Đơn Hàng Bán Hàng](#6-đơn-hàng-bán-hàng)
7. [Truy Xuất Nguồn Gốc (QR + Blockchain)](#7-truy-xuất-nguồn-gốc-qr--blockchain)
8. [Báo Cáo & Thống Kê](#8-báo-cáo--thống-kê)
9. [Cài Đặt](#9-cài-đặt)
10. [Thao Tác Nhanh](#10-thao-tác-nhanh)

---

## 1. Đăng Nhập & Màn Hình Chính

### Đăng nhập lần đầu
1. Mở ứng dụng → thấy màn hình nhập PIN
2. Nhập `1234` → nhấn **OK**
3. Nếu thiết bị có vân tay / Face ID → chọn **Đăng ký** để đăng nhập nhanh lần sau

### Màn hình chính

```
 ┌─────────────────────────┐
 │  EcoSynTech Farm OS     │
 │                         │
 │  ☀ Dashboard            │
 │  🌱 Vườn / Lô           │
 │  📦 Vật tư              │
 │  💧 Tưới                │
 │  📋 Đơn hàng            │
 │  📷 QR Scan             │
 │  ⛓ Blockchain           │
 │  📊 Báo cáo             │
 │  ⚙ Cài đặt             │
 └─────────────────────────┘
```

Chạm vào mục nào để vào chức năng đó.

---

## 2. Dashboard — Theo Dõi Tổng Quan

Dashboard là trang đầu tiên sau đăng nhập, hiển thị:

### Khu vực 1 — Cảm biến thời tiết
| Thông số | Mô tả |
|----------|-------|
| 🌡 Nhiệt độ | °C hiện tại (và biểu đồ 24h) |
| 💧 Độ ẩm | % không khí |
| 🌧 Lượng mưa | mm hôm nay |
| ☀ Ánh sáng | lux |
| 💨 Gió | m/s |

### Khu vực 2 — Cảnh báo
- 🔴 **Đỏ:** Khẩn cấp (nhiệt độ > 40°C, độ ẩm < 20%)
- 🟡 **Vàng:** Cảnh báo (nhiệt độ > 35°C, sắp ngưỡng)
- 🟢 **Xanh:** Bình thường

### Khu vực 3 — Thống kê nhanh
| Chỉ số | Ví dụ |
|--------|-------|
| Tổng số lô đang canh tác | 12 lô |
| Diện tích | 3.5 ha |
| Sản lượng dự báo | 1,200 kg |
| Đơn hàng chờ xử lý | 5 đơn |

### Thao tác
- 🔄 Kéo xuống để làm mới
- 🔁 Nhấn nút **Làm mới** để cập nhật dữ liệu cảm biến

---

## 3. Quản Lý Vườn / Lô

### 3.1 Danh sách lô
Vào **Vườn / Lô** → thấy danh sách các lô đang canh tác:
- Mỗi lô hiển thị: tên, cây trồng, ngày gieo, diện tích, trạng thái
- Nhấn vào lô để xem chi tiết

### 3.2 Tạo lô mới
1. Nhấn **+ Thêm lô**
2. Nhập:
   - **Tên lô:** VD "Lô A1 - Rau muống"
   - **Cây trồng:** Chọn từ danh sách (rau muống, cà chua, dưa leo...)
   - **Diện tích:** Số m²
   - **Ngày gieo:** Chọn ngày
   - **Ghi chú:** (không bắt buộc)
3. Nhấn **Lưu**

### 3.3 Ghi nhật ký lô
Trong chi tiết lô → **Nhật ký**:
- **Tưới:** Ghi lại lượng nước, thời gian
- **Bón phân:** Loại phân, số lượng
- **Phun thuốc:** Loại thuốc, liều lượng, thời gian cách ly
- **Thu hoạch:** Sản lượng, ngày thu
- **Ghi chú chung**

> ⚠ **PHI guard:** Nếu còn thời gian cách ly, app sẽ **chặn không cho thu hoạch** — đảm bảo an toàn thực phẩm.

### 3.4 Cập nhật trạng thái lô
| Trạng thái | Ý nghĩa |
|-----------|---------|
| 🌱 Gieo trồng | Mới gieo hạt/trồng cây |
| 🌿 Sinh trưởng | Đang phát triển |
| 🌸 Ra hoa | Cây bắt đầu ra hoa |
| 🍎 Tạo quả | Có quả non |
| 🧑‍🌾 Thu hoạch | Đã thu hoạch xong |

### 3.5 Chia sẻ / In QR
Nhấn nút **QR** → app tạo mã QR truy xuất nguồn gốc cho lô đó. Có thể:
- Chia sẻ qua Zalo / Messenger
- Lưu ảnh để in tem dán sản phẩm

---

## 4. Vật Tư — Nhập Xuất Tồn Kho

### 4.1 Danh sách vật tư
Vào **Vật tư** → thấy kho vật tư gồm:
- Hạt giống
- Phân bón
- Thuốc BVTV
- Dụng cụ, vật tư khác

### 4.2 Nhập kho
1. Nhấn **+ Nhập**
2. Chọn loại vật tư (hoặc nhập tên mới)
3. Số lượng, đơn vị (kg, lít, bao, cái...)
4. Đơn giá (không bắt buộc)
5. Nhà cung cấp
6. Nhấn **Nhập kho**

### 4.3 Xuất kho
1. Nhấn **+ Xuất**
2. Chọn vật tư cần xuất
3. Số lượng
4. Chọn lô đích (vật tư dùng cho lô nào)
5. Nhấn **Xuất kho**

### 4.4 Kiểm kho
Vào **Kiểm kê** → app hiển thị tồn kho thực tế so với sổ sách.

### 4.5 Xuất CSV
Nhấn **Xuất CSV** → tải file Excel mọi người đều mở được.

---

## 5. Tưới Thông Minh

### 5.1 Chọn chế độ tưới
Vào **Tưới** → chọn 1 trong 4 chế độ:

| Chế độ | Mô tả |
|--------|-------|
| 🌤 **Theo cảm biến** | Tự động tưới khi độ ẩm đất dưới ngưỡng |
| 📅 **Theo lịch** | Tưới theo lịch cố định (VD: 6h sáng, 5h chiều) |
| ⚡ **Lịch + Cảm biến** | Tưới theo lịch nhưng bỏ qua nếu trời mưa |
| 🌱 **Theo cây trồng (ETo·Kc)** | Tưới dựa vào loại cây + giai đoạn sinh trưởng |

### 5.2 Cài đặt lịch tưới
1. Chọn chế độ → nhấn **Cài đặt**
2. Chọn lô cần tưới
3. Thiết lập:
   - **Giờ tưới:** VD 6:00, 17:00
   - **Thời lượng:** 15-30 phút
   - **Ngưỡng độ ẩm:** (nếu chọn chế độ cảm biến)
4. Nhấn **Lưu**

### 5.3 Mùa vụ
App tự động điều chỉnh lịch tưới theo:
- **Mùa khô:** Tưới nhiều hơn
- **Mùa mưa:** Giảm tần suất, tránh ngập úng
- **Theo loại cây:** Rau ăn lá / quả / củ có nhu cầu nước khác nhau

### 5.4 Tránh nắng gắt
App **tự động chặn tưới** trong khung giờ 11:00-14:00 (nắng gắt, nước bốc hơi nhanh, hại cây).

### 5.5 Lịch sử tưới
Xem lại các lần tưới đã thực hiện: thời gian, lượng nước, lô.

---

## 6. Đơn Hàng Bán Hàng

### 6.1 Danh sách đơn
Vào **Đơn hàng**:
- **Tất cả đơn:** Xem toàn bộ
- **Chờ xử lý:** Đơn mới, chưa thanh toán
- **Đã thanh toán:** Đã thu tiền
- **Đã huỷ:** Đơn đã huỷ

### 6.2 Tạo đơn hàng mới
1. Nhấn **Tạo đơn**
2. Nhập:
   - **Tên khách hàng**
   - **Số điện thoại**
   - **Địa chỉ**
   - **Danh sách sản phẩm:** Tên, số lượng, đơn giá
   - **Ghi chú**
3. Chọn phương thức thanh toán:
   - 💵 **Tiền mặt**
   - 🏦 **Chuyển khoản**
   - 💳 **MoMo**
   - 💳 **ZaloPay**
4. Nhấn **Lưu**

### 6.3 Cập nhật trạng thái
- Nhấn vào đơn → **Xác nhận** (đã giao hàng)
- **Thanh toán** (đã nhận tiền)
- **Huỷ** (nếu có lý do)

### 6.4 Thống kê bán hàng
Vào tab **Thống kê** → xem:
- Tổng doanh thu (hôm nay, tuần này, tháng này)
- Số đơn hàng
- Khách hàng thân thiết
- Biểu đồ doanh thu

---

## 7. Truy Xuất Nguồn Gốc (QR + Blockchain)

### 7.1 Quét QR
1. Vào **QR Scan**
2. Quét mã QR trên sản phẩm (dùng camera)
3. App hiển thị đầy đủ thông tin:
   - Tên sản phẩm
   - Ngày gieo trồng → thu hoạch
   - Quy trình canh tác (bón phân, phun thuốc gì, ngày nào)
   - Chứng nhận VietGAP
   - Dữ liệu blockchain (hash giao dịch)

### 7.2 Tạo QR cho lô
Trong chi tiết lô → nhấn **Tạo QR** → app sinh mã QR chứa thông tin truy xuất. Dán lên sản phẩm để khách hàng quét.

### 7.3 Ghi Blockchain (Aptos)
1. Vào **Blockchain**
2. Chọn lô cần ghi
3. Nhấn **Ghi lên Blockchain**
4. App tạo giao dịch trên mạng Aptos — dữ liệu **không thể sửa, không thể xoá**

### 7.4 Xem dữ liệu Blockchain
- Nhấn vào giao dịch → xem chi tiết
- Có thể xem trực tiếp trên Aptos Explorer (link trong app)

### 7.5 Xuất PDF truy xuất
Trong chi tiết lô → **In PDF** → tạo phiếu VietGAP đầy đủ:
- Logo trại
- Thông tin sản phẩm
- Nhật ký canh tác
- Mã QR
- Chữ ký số

---

## 8. Báo Cáo & Thống Kê

Vào **Báo cáo** để xem các báo cáo tổng hợp:

### 8.1 Báo cáo mùa vụ
- Sản lượng theo từng lô
- Năng suất (kg/m²)
- So sánh giữa các vụ

### 8.2 Báo cáo vật tư
- Tồn kho hiện tại
- Vật tư đã sử dụng trong kỳ
- Chi phí vật tư

### 8.3 Báo cáo tài chính
- Doanh thu bán hàng
- Chi phí sản xuất
- Lợi nhuận

### 8.4 Dự báo
App tự động dự báo dựa trên dữ liệu mùa vụ trước:
- **Sản lượng dự kiến** vụ tiếp theo
- **Thời gian thu hoạch**
- **Khuyến nghị** giống cây trồng

---

## 9. Cài Đặt

### 9.1 Đổi PIN
1. Vào **Cài đặt → Đổi PIN**
2. Nhập **PIN hiện tại** (`1234` nếu chưa đổi)
3. Nhập **PIN mới** (4-6 chữ số)
4. Nhập lại PIN mới để xác nhận
5. Nhấn **Đổi PIN**

> ⚠ Nhớ PIN mới! Nếu quên, phải gỡ cài đặt app và cài lại.

### 9.2 Ngôn ngữ
1. Vào **Cài đặt → Ngôn ngữ**
2. Chọn **Tiếng Việt** hoặc **English**
3. App chuyển ngay lập tức

### 9.3 Vân tay / Face ID
1. Vào **Cài đặt → Sinh trắc học**
2. Chọn **Đăng ký** → làm theo hướng dẫn
3. Lần sau mở app chỉ cần chạm vân tay / nhìn mặt

### 9.4 Hồ sơ trại
- **Tên trại:** VD "Trại rau sạch Ba Vì"
- **Địa chỉ:** Xã, huyện, tỉnh
- **Chủ trại:** Họ tên
- **Số điện thoại**

### 9.5 Chế độ demo
Vào **Cài đặt → Demo bán hàng → Tạo dữ liệu mẫu** để tạo sẵn dữ liệu demo (không cần backend).

### 9.6 Cloud / Sync
Cấu hình đồng bộ dữ liệu lên cloud (nếu có):
- **URL Cloud:** Địa chỉ server
- **Token:** Mã xác thực

---

## 10. Thao Tác Nhanh

### Phím tắt trên màn hình chính

| Thao tác | Kết quả |
|----------|---------|
| 📷 Nhấn QR Scan | Mở camera quét mã QR |
| 🔄 Kéo xuống | Làm mới dữ liệu |
| 📤 Chia sẻ QR | Gửi mã truy xuất qua Zalo/Messenger |

### Lưu ý quan trọng

- ✅ **Luôn backup PIN:** Ghi PIN ra giấy để tránh quên
- ✅ **Thường xuyên kiểm tra dashboard:** Để nhận cảnh báo sớm
- ✅ **Ghi nhật ký đầy đủ:** Đảm bảo truy xuất nguồn gốc chính xác
- ✅ **Xuất CSV vật tư định kỳ:** Để đối chiếu kiểm kho
- ❌ **Không tưới trong khung 11h-14h:** Tránh sốc nhiệt cho cây
- ❌ **Không thu hoạch khi còn thời gian cách ly:** App đã chặn, nhưng cần tuân thủ

---

## Câu hỏi thường gặp

**Hỏi:** Quên PIN thì làm sao?  
**Đáp:** Phải gỡ cài đặt app và cài lại. Dữ liệu offline sẽ mất (nếu chưa đồng bộ cloud).

**Hỏi:** App không kết nối được cảm biến?  
**Đáp:** Kiểm tra WiFi, kiểm tra ESP32 có bật không. Dashboard sẽ dùng dữ liệu cache nếu mất mạng.

**Hỏi:** QR không quét được?  
**Đáp:** Đảm bảo đủ ánh sáng, giữ camera cách QR 10-20cm.

**Hỏi:** Làm sao để xoá lô?  
**Đáp:** Chỉ có thể xoá lô chưa có dữ liệu. Lô đã có nhật ký → đánh dấu **kết thúc** thay vì xoá.

**Hỏi:** Dùng được trên iPhone không?  
**Đáp:** Hiện tại app chạy trên Android. Trên iOS có thể dùng qua trình duyệt (PWA) — làm theo hướng dẫn triển khai.

---

## Liên Hệ Hỗ Trợ

- **Zalo:** 0989516698
- **Email:** kd.ecosyntech@gmail.com
- **Website:** https://ecosyntech-farmos.netlify.app/

---

*Made with care in Vietnam · Built for Vietnamese farmers*
