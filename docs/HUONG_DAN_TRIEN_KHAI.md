# Hướng Dẫn Triển Khai EcoSynTech Farm OS

> **Phiên bản:** V6.3.0  
> **Mục đích:** Chạy ứng dụng quản lý nông trại trên máy tính local, dùng qua WiFi nội bộ (không cần internet) hoặc qua VPN (Tailscale) để dùng từ xa.

---

## I. Yêu Cầu Hệ Thống

| Thành phần | Yêu cầu |
|---|---|
| **Máy tính** | Windows 10+, macOS 12+, hoặc Linux (bất kỳ) |
| **Node.js** | >= 18.0.0 |
| **RAM** | Tối thiểu 2GB |
| **Ổ cứng** | 500MB trống |
| **WiFi** | Router WiFi (hoặc máy tính phát WiFi) |

---

## II. Cài Đặt Môi Trường

### 1. Cài Node.js

**🔹 Windows / macOS:**
- Vào https://nodejs.org → tải bản **LTS** (~20.x)
- Cài đặt: Next → Next → Finish
- Mở Terminal (Command Prompt) kiểm tra:
```bash
node --version   # phải thấy v20.x.x
npm --version    # phải thấy 10.x.x
```

**🔹 Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install nodejs -y
node --version
npm --version
```

### 2. Tải code về máy

```bash
git clone https://github.com/ecosyntech68vn/App-EcoSynTech-Global-.git
cd App-EcoSynTech-Global-
```

> Nếu chưa có `git`, vào link GitHub → nút **Code** → **Download ZIP** → giải nén.

### 3. Cài dependencies

```bash
npm install
```

Chờ 1-2 phút. Nếu lỗi, chạy lại lần nữa.

---

## III. Chạy Ứng Dụng

### 🔹 Chạy trên máy tính (dev server)

```bash
npm run dev
```

Sau vài giây sẽ thấy:
```
➜  Local:   http://localhost:5173
```

Mở trình duyệt vào `http://localhost:5173` — app đã sẵn sàng.

---

## IV. Dùng Trên Cả Phòng Qua WiFi (Không Cần Internet)

### Cách 1: Máy tính phát WiFi trực tiếp

**Windows:**
1. Settings → Network & Internet → Mobile hotspot
2. Bật **Mobile hotspot**, đặt tên + mật khẩu
3. Ghi lại IP: mở CMD gõ `ipconfig` → tìm `IPv4 Address` (vd: `192.168.137.1`)

**macOS:**
1. System Settings → General → Sharing → Internet Sharing
2. Chia sẻ từ Ethernet → sang WiFi

**Linux:**
```bash
sudo apt install create-ap
sudo create_ap wlan0 eth0 TenWiFi MatKhau
```

### Cách 2: Dùng chung router WiFi

- Máy tính và điện thoại cùng kết nối 1 router WiFi
- Tìm IP máy tính: `ipconfig` (Windows) hoặc `ip a` (Mac/Linux) → dòng `192.168.x.x`

### Kết nối từ điện thoại

1. Điện thoại kết nối vào WiFi đó
2. Mở trình duyệt (Chrome/Safari)
3. Gõ `http://<IP-của-máy>:5173`

Ví dụ: `http://192.168.1.10:5173`

### Cài như app trên điện thoại (PWA)

- **iPhone (Safari):** vào link → nút Chia sẻ → **Add to Home Screen**
- **Android (Chrome):** vào link → nút 3 chấm → **Install App**

Xong. Mở ra full màn hình, không thanh địa chỉ.

---

## V. Dùng Từ Xa Qua Internet (VPN)

### Cài Tailscale (miễn phí, 3 phút)

```bash
# Trên máy tính chạy app
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up   # đăng nhập Google
tailscale ip        # ghi lại IP (vd: 100.x.x.x)
```

**Trên điện thoại:**
1. Cài app **Tailscale** từ CH Play / App Store
2. Đăng nhập cùng tài khoản Google
3. Vào trình duyệt gõ `http://100.x.x.x:5173`

---

## VI. Build APK Android (Cài Trực Tiếp)

Nếu muốn file `.apk` cài vào điện thoại (không cần dev server):

### Bước 1: Cài Android Studio
- Tải từ https://developer.android.com/studio
- Cài đặt, mở → **SDK Manager** → cài SDK 34

### Bước 2: Thêm nền tảng Android
```bash
npm run build
npx cap add android
npm run cap:sync
```

### Bước 3: Build APK
```bash
npm run android:debug
```

File APK ở: `android/app/build/outputs/apk/debug/app-debug.apk`

Copy sang điện thoại → cài (nhớ bật "Cài từ nguồn không xác định").

---

## VII. Hướng Dẫn Sử Dụng Chính

### Đăng nhập lần đầu
- **PIN mặc định:** `1234`
- Thiết lập sinh trắc học (vân tay / Face ID) khi được hỏi

### Màn hình chính
| Nút | Chức năng |
|-----|-----------|
| Dashboard | Xem cảm biến, thời tiết, cảnh báo |
| Vườn / Lô | Quản lý lô, mùa vụ, ghi nhật ký |
| Vật tư | Nhập – xuất – tồn kho |
| Tưới | Lập lịch tưới thông minh theo mùa |
| Đơn hàng | Quản lý bán hàng, thống kê |
| QR Scan | Quét QR truy xuất nguồn gốc |
| Blockchain | Ghi dữ liệu lên Aptos (truy xuất) |
| Cài đặt | Đổi PIN, chọn ngôn ngữ, hồ sơ |

### Đổi PIN
1. Vào **Cài đặt**
2. Nhập PIN cũ (`1234`), PIN mới, xác nhận
3. Nhấn **Đổi PIN**

### Chọn ngôn ngữ
Vào Cài đặt → chọn **Tiếng Việt** / **English**

### Tạo đơn hàng
1. Vào **Đơn hàng** → **Tạo đơn**
2. Nhập tên khách, sản phẩm, số tiền
3. Chọn phương thức thanh toán (Tiền mặt / Chuyển khoản / MoMo / ZaloPay)
4. Nhấn **Lưu**

### Truy xuất nguồn gốc
1. Vào **Lô** → chọn lô đã thu hoạch
2. Nhấn **QR** → quét bằng app hoặc in ra dán sản phẩm

---

## VIII. Cấu Trúc Thư Mục

```
App-EcoSynTech-Global-/
├── src/
│   ├── pages/        # 21+ màn hình
│   ├── stores/       # 7 store (auth, order, forecast, blockchain...)
│   ├── api/          # fallback-client (LAN ↔ Cloud)
│   ├── db/           # IndexedDB
│   ├── components/   # UI components
│   └── styles/       # CSS
├── docs/             # Tài liệu
├── scripts/          # Build script
├── android-templates/
├── play-store-kit/
└── trace-landing/    # QR resolution page
```

---

## IX. Các Lệnh Thường Dùng

| Lệnh | Mục đích |
|------|---------|
| `npm run dev` | Chạy dev server (localhost:5173) |
| `npm run build` | Build cho production |
| `npm run test` | Chạy test |
| `npm run preview` | Xem bản build |
| `npm run android:all` | Build full (debug + release + bundle) |

---

## X. Xử Lý Lỗi Thường Gặp

**Lỗi:** `Error: listen EADDRINUSE :::5173`  
→ Cổng 5173 đã dùng. Sửa: mở `vite.config.js` đổi port khác (vd: 3000).

**Lỗi:** `npm install` thất bại  
→ Thử: `npm cache clean --force && npm install`

**Lỗi:** App không load trên điện thoại  
→ Kiểm tra: cùng WiFi? Đúng IP? Có firewall chặn port 5173?  
→ Tắt firewall tạm thời hoặc thêm rule cho phép port 5173.

**Lỗi:** Tailscale không kết nối  
→ Kiểm tra cả 2 thiết bị đã đăng nhập cùng tài khoản?  
→ Vào admin console: https://login.tailscale.com → kiểm tra thiết bị.

---

## XI. Liên Hệ & Hỗ Trợ

- **Zalo:** 0989516698
- **Email:** kd.ecosyntech@gmail.com

---

*Made with care in Vietnam · Built for Vietnamese farmers*
