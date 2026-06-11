# Cài APK lên phone CEO — 5 bước, ~10 phút

> Sau khi build xong, file `dist/farmos-v1.0.0-release.apk` (hoặc `-debug.apk`) sẵn sàng.

## Bước 1 — Copy APK sang phone

**Cách A: USB cable (nhanh nhất)**
1. Cắm phone vào máy tính
2. Phone hỏi "USB use for…" → chọn **File transfer / MTP**
3. Mở File Explorer → vào `Phone storage\Download`
4. Copy file `farmos-v1.0.0-release.apk` từ `D:\ECOSYNTECHGLOBAL2026\FarmOS-Mobile\dist\` vào đó

**Cách B: Zalo/Telegram/email**
1. Gửi APK cho chính mình qua Zalo "Tôi" hoặc Telegram "Saved Messages"
2. Mở Zalo/Telegram trên phone → tap file → "Save to Downloads"

**Cách C: Cloud (Drive)**
1. Upload lên Google Drive cá nhân
2. Trên phone mở Drive → tap file → "Download"

## Bước 2 — Bật "Install unknown apps"

Lần đầu cài APK ngoài CH Play, Android sẽ chặn. Bật quyền:

1. Mở **Settings** → **Apps** → **Special access** → **Install unknown apps**
2. Chọn app sẽ mở APK (Chrome, Files, Zalo, Drive, …)
3. Bật toggle **Allow from this source**

(Hoặc chỉ cần tap APK lần đầu, Android sẽ hỏi → "Settings" → bật → quay lại "Install".)

## Bước 3 — Cài APK

1. Mở **Files / My Files** app → vào **Downloads**
2. Tap `farmos-v1.0.0-release.apk`
3. Android hiện dialog: "Do you want to install this app?"
4. Tap **Install**
5. Đợi 5-10s → xong → tap **Open** hoặc **Done**

## Bước 4 — Cấu hình lần đầu

App mở → màn hình Login.

1. **Server URL**: nhập IP máy chạy WLC + port 3000
   - VD: `http://192.168.1.100:3000`
   - Tìm IP: trên máy WLC mở CMD → `ipconfig` → tìm "IPv4 Address" (192.168.x.x)

2. **Chế độ mạng**: chọn **Auto (LAN → fallback Cloud)** cho an toàn

3. Bấm **Test kết nối** → phải thấy toast `✓ Kết nối OK`
   - Nếu fail: kiểm tra phone + máy WLC cùng WiFi, WLC server đã chạy chưa, firewall block port 3000 không

4. **PIN**: nhập PIN của farmer (tạo trước trên WLC bằng admin)

5. Bấm **Đăng nhập**

## Bước 5 — Smoke test (3 màn quan trọng)

### Test 1 — Sensor Dashboard
- App tự vào tab "Sensor"
- Phải thấy ≥1 zone card với giá trị temp/hum/pH
- Pull-to-refresh (kéo xuống) → nhận data mới
- ✅ PASS nếu data hiển thị

### Test 2 — Log offline + sync
- Bật **Airplane mode** trên phone
- Vào tab "Log" → chọn "Tưới nước", Zone "Z01", ghi chú "Test offline"
- Bấm **Lưu nhật ký**
- Toast `⏳ Queue offline — sẽ sync sau`
- Tắt Airplane mode → đợi 30s (hoặc Settings → "↻ Sync ngay")
- Quay lại tab "Log" → entry đó đổi pill thành **SYNCED**
- ✅ PASS nếu entry sync xong

### Test 3 — Logout
- Tab Settings → **Đăng xuất** → confirm
- App back về Login
- Đóng app + mở lại → vẫn ở Login (không auto-login)
- ✅ PASS

---

**3/3 PASS** → APK OK trên phone CEO. Cài cho farmer pilot.

**1-2 FAIL** → báo em, em fix critical trước ship rộng.

## Troubleshoot phổ biến

| Lỗi | Fix |
|---|---|
| Phone báo "App not installed" | Đã có app cũ cùng package → uninstall trước rồi cài lại |
| Toast "Cannot reach server" | WLC chưa chạy hoặc khác WiFi |
| Login fail HTTP 401 | PIN sai, hoặc farmer chưa tạo trên WLC |
| Dashboard rỗng | WLC chưa có sensor data → tạo fake data test trước |
| App crash khi mở camera | Quyền Camera chưa allow → Settings → Apps → EcoSynTech → Permissions → Camera ON |
| App chạy chậm | Phone quá yếu (RAM <2GB) → V1.0 đã frugal hết mức, không tối ưu được nữa |

## Backup APK

Sau khi cài OK, BACKUP `farmos-v1.0.0-release.apk` vào 2 chỗ:
- Google Drive cá nhân
- USB external

Để khi cần cài lại farmer khác trong rẫy không có internet, có sẵn APK.
