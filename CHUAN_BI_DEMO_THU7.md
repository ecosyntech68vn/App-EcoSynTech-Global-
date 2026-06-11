# CHUẨN BỊ DEMO THỨ 7 — CHECKLIST TỪNG LỆNH (CEO tự chạy, ~40 phút)

> 3 việc: ① Build APK + cài máy + dữ liệu mẫu · ② Deploy trace-landing · ③ Chạy thử kịch bản 1 lần.
> Máy cần: Windows này (đã có Node + Android Studio), điện thoại Android + cáp USB.

---

## ① BUILD APK + DỮ LIỆU MẪU (~25 phút, phần lớn là máy tự chạy)

### Bước 1 — Build (1 lệnh, KHÔNG cần mở Android Studio)
Mở **Command Prompt** (Start → gõ `cmd` → Enter):
```bat
cd /d D:\ECOSYNTECHGLOBAL2026\FarmOS-Mobile
scripts\build-all-v4.bat
```
Script tự làm: npm install → tạo platform Android (nếu chưa có) → vite build → gradle. Bản DEBUG (đủ demo) được build + copy ra `dist\farmos-v4.0.0-debug.apk` TRƯỚC; release fail cũng không ảnh hưởng demo. Android Studio chỉ cần ĐÃ CÀI trên máy (để có SDK) — không phải mở.

**2 tình huống giữa chừng:**
- Script dừng báo *"MERGE the following templates"* (chỉ xảy ra lần đầu tạo android/): mở 3 file template nó liệt kê, chép nội dung vào file thật cùng chỗ (bỏ đuôi `.template`; riêng `build.gradle.snippet` chép khối versionCode vào `android/app/build.gradle`, sửa thành **40 / "4.0.0"**). Thêm `android:networkSecurityConfig="@xml/network_security_config"` vào thẻ `<application>` và chép `network_security_config.xml.template` → `res/xml/network_security_config.xml`. Xong bấm phím bất kỳ cho script chạy tiếp.
- Gradle báo lỗi keystore khi assembleRelease: **kệ nó** — demo chỉ cần bản DEBUG. Miễn thấy file `dist\farmos-*-debug.apk` (hoặc `android\app\build\outputs\apk\debug\app-debug.apk`) là đạt.

### Bước 2 — Cài vào điện thoại (3 phút)
Điện thoại: Cài đặt → Giới thiệu → gõ 7 lần "Số bản dựng" → bật **Gỡ lỗi USB** trong Tuỳ chọn nhà phát triển. Cắm cáp, chọn "Cho phép":
```bat
cd /d D:\ECOSYNTECHGLOBAL2026\FarmOS-Mobile
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```
(Không có adb trong PATH: chép file APK qua Zalo gửi chính mình → mở trên điện thoại → cài.)

### Bước 3 — Dữ liệu mẫu (2 phút, làm trên điện thoại)
1. Mở app → mode **Local (Offline)** → PIN **1234** → vào được dashboard.
2. **Settings → đổi PIN mới** (sẽ đưa máy cho khách cầm).
3. Settings → **🎬 Demo bán hàng → ＋ Tạo dữ liệu mẫu** → báo "Đã tạo 2 lô mẫu".
4. Kiểm tra: More → **Lô / Mùa vụ** → thấy lô Rau muống ✓ đã thu hoạch + lô Cà chua 🔒 PHI.
5. Settings → **Gói dịch vụ** → để sẵn **🚜 Farmer** (gói sẽ demo chính).

---

## ② DEPLOY LÊN NETLIFY (~5 phút) — BẮT BUỘC trước thứ 7

> Làm cho QR quét RA TRANG THẬT + bảng giá có link gửi khách. KHÔNG cần domain (KYC tính sau), KHÔNG cần GitHub.
> Thư mục đã chuẩn bị sẵn: `D:\MOHINH_AI_FIRST_ECOSYNTECHGLOBAL\website-deploy\` (bảng giá = trang chủ, truy xuất = /t/*).

1. Vào **app.netlify.com** → đăng nhập (tài khoản Google/email đều được, free).
2. Trang Sites → kéo **NGUYÊN THƯ MỤC** `website-deploy` thả vào ô "Drag and drop your site folder here" (Netlify Drop).
3. Deploy xong → **Site configuration → Change site name** → đặt đúng tên: **`ecosyntech-farmos`**
   → site thành `https://ecosyntech-farmos.netlify.app` — **APK đã trỏ sẵn vào địa chỉ này, đặt đúng tên là QR chạy luôn, không phải build lại.**
   (Nếu tên bị trùng: đặt tên khác → mở `src\db\trace.js` sửa 1 dòng `netlify.app` theo tên mới → build lại Bước ①.)
4. **Test 3 link:**
   - `https://ecosyntech-farmos.netlify.app` → bảng giá aurora hiện đẹp, bấm nút gói → mở Zalo
   - `https://ecosyntech-farmos.netlify.app/trace/?demo=1` → trang truy xuất hồ sơ mẫu
   - Quét QR từ app (sau Bước ①+③) → ra hồ sơ lô thật
5. Sau này domain hết bị block: Netlify → Domain settings → add `trace.ecosyntech.vn`/`ecosyntechglobal.com` — không phải làm lại gì.

> **GitHub repo (làm sau, không chặn thứ 7):** nên tạo repo `ecosyntech-site` đẩy thư mục `website-deploy` lên để có version control + Netlify auto-deploy mỗi lần sửa. Hướng dẫn trong `website-deploy\README_DEPLOY.md`.

---

## ③ CHẠY THỬ KỊCH BẢN 1 LẦN (~10 phút, theo DEMO_GUIDE_V4.md)

Tổng duyệt đúng thứ tự sẽ diễn với khách:

- [ ] 1. **Bật chế độ máy bay** → mở app → login PIN → dashboard vẫn vào. *(Câu: "Mất mạng vẫn chạy")*
- [ ] 2. More → Lô/Mùa vụ → lô Rau muống → cuộn timeline nhật ký. *(Hồ sơ tự ghi, không sửa được)*
- [ ] 3. Bấm QR → quét bằng điện thoại thứ 2 → trang truy xuất hiện. **← bước chốt đơn, phải mượt**
- [ ] 4. Mở lô Cà chua 🔒 → bấm thu hoạch → bị chặn PHI. *(An toàn thực phẩm)*
- [ ] 5. More → Tưới thông minh → Mẫu nhanh "Mùa khô · Rau ăn lá" → Áp dụng → Lưu. *(Tạo quy tắc 10 giây)*
- [ ] 6. Lô Rau muống → Xuất phiếu PDF → mở file xem tiếng Việt đủ dấu.
- [ ] 7. Settings → đổi gói Home → quay lại More bấm "Tưới thông minh" → hiện màn khoá + giá nâng cấp. Đổi về Farmer. *(Demo phân gói)*
- [ ] 8. Tắt chế độ máy bay. Ghi 1 nhật ký mới khi CÓ mạng xem toast — biết trước app phản ứng gì (chưa có WLC thật → sẽ báo queue offline, câu trả lời cho khách: "đang chờ đồng bộ bộ điều khiển trung tâm — lắp thật là tự chạy").

**Mang theo thứ 7:** điện thoại demo (pin đầy + sạc dự phòng), bảng giá (mở sẵn `pricing-section.html` trên điện thoại/laptop hoặc in), sổ ghi đơn tiên phong (đánh số suất 1-10), DEMO_GUIDE_V4.md đọc lại 1 lần trên xe.

**Nếu kẹt bất kỳ bước nào** → chụp màn hình lỗi gửi vào phiên Claude này, tôi xử lý tiếp.
