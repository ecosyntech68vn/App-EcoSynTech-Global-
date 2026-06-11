# Privacy Policy — EcoSynTech Farm OS Mobile

**Effective date:** 2026-06-10
**Publisher:** EcoSynTech Global · Vietnam

## 1. Tóm tắt

EcoSynTech Farm OS Mobile ("App") thu thập **tối thiểu** dữ liệu cần thiết để vận hành nông nghiệp chính xác. Không quảng cáo, không bán dữ liệu, không tracker bên thứ 3.

## 2. Data thu thập

| Loại | Mục đích | Lưu ở đâu | Có chia sẻ? |
|---|---|---|---|
| Server URL người dùng nhập | Kết nối backend nông trại | Thiết bị (Capacitor Preferences) | Không |
| PIN/OTP nhập đăng nhập | Xác thực | Gửi 1 lần đến server của người dùng, không lưu plaintext | Không |
| JWT token | Phiên đăng nhập | Thiết bị (encrypted Preferences) | Không |
| Sensor data lấy từ server | Hiển thị Dashboard | Cache IndexedDB | Không |
| Ảnh chụp qua app | Đính kèm nhật ký vận hành | Thiết bị + gửi đến server của người dùng | Không (chỉ server riêng) |
| Operation log nhập tay | Lưu lịch sử công việc | Thiết bị + sync server riêng | Không |
| Telemetry ẩn danh (crash) | Cải thiện app | KHÔNG thu thập trong V1.0 | Không |

## 3. Server backend

App giao tiếp duy nhất với:
- **WLC LAN server** (do người dùng tự host trong nông trại)
- **GAS Cloud fallback** (Google Apps Script do người dùng tự deploy)

Cả 2 đều thuộc sở hữu của người dùng/tổ chức của họ. EcoSynTech Global **không** vận hành server trung gian, **không** nhận được data từ app.

## 4. Quyền Android sử dụng

| Quyền | Lý do |
|---|---|
| `INTERNET` | Gọi API server riêng |
| `ACCESS_NETWORK_STATE` | Hiển thị banner offline |
| `CAMERA` | Chụp ảnh đính kèm log |
| `READ_MEDIA_IMAGES` (Android 13+) | Đọc ảnh từ thư viện (tuỳ chọn) |

KHÔNG yêu cầu: vị trí (GPS), microphone, contacts, calendar, storage rộng.

## 5. Trẻ em

App không nhắm đến trẻ em <16. Nếu phát hiện tài khoản trẻ em, sẽ vô hiệu hoá khi báo cáo.

## 6. Bảo mật

- Token JWT lưu Android Keystore-backed Preferences (encrypted).
- HTTPS bắt buộc khi dùng Cloud (GAS), HTTP cleartext chỉ cho phép trong LAN nội bộ.
- Không có analytics SDK bên thứ 3 (Firebase, Google Analytics, Sentry...) trong V1.0.

## 7. Xoá data

Người dùng có thể:
- **Logout** → xoá JWT khỏi thiết bị.
- **Settings → Xoá queue** → xoá toàn bộ data offline.
- **Uninstall app** → xoá tất cả data thiết bị.
- Xoá data server: yêu cầu trực tiếp admin nông trại của họ (EcoSynTech không can thiệp được vì không có quyền truy cập).

## 8. Thay đổi chính sách

Bản chính sách này có thể cập nhật. Phiên bản mới sẽ đăng tại:
`https://github.com/ecosyntech-global/farmos-mobile/blob/main/PRIVACY_POLICY.md`

## 9. Liên hệ

- Email: kd.ecosyntech@gmail.com
- Đại diện pháp lý: CEO Thuận, EcoSynTech Global
