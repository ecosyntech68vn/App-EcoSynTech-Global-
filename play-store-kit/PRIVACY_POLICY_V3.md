# Privacy Policy V3.0 — EcoSynTech Farm OS Mobile

**Effective date:** 2026-06-10  
**Version:** 3.0.0  
**Publisher:** EcoSynTech Global · Vietnam

## 1. Tóm tắt

EcoSynTech Farm OS Mobile thu thập **tối thiểu** data cần thiết. Không quảng cáo, không bán data, không tracker bên thứ 3.

## 2. Data thu thập V3.0

| Loại | Mục đích | Lưu ở đâu | Có chia sẻ? |
|---|---|---|---|
| Server URL người dùng | Kết nối backend | Capacitor Preferences | Không |
| PIN/OTP/Biometric | Xác thực | Gửi server riêng, biometric local-only | Không |
| JWT token | Phiên đăng nhập | Android Keystore | Không |
| Sensor data | Hiển thị Dashboard | IndexedDB cache | Không |
| **GPS coordinates (V1.1+V1.3)** | Stamp metadata log + Geofence | Local + gửi server riêng | Không |
| Ảnh chụp + thumbnail | Đính kèm log | Filesystem + server riêng | Không |
| Device control commands | Audit trail | Server riêng (có timestamp + farmer ID) | Không |
| Schedule | Lịch tự động | Server riêng | Không |
| **Weather API queries (V1.2)** | Forecast | OpenWeather (lat/lng anonymized) | Có (chỉ OpenWeather, dùng key của user) |
| **OTA version check (V1.2)** | Cập nhật app | GitHub Releases public API | Có (GitHub, không có data cá nhân) |
| **Local notifications (V1.1)** | Báo alert mới | Local-only, không gửi đi đâu | Không |
| Farmer ID + Role + Active farm | Multi-role/farm | Preferences | Không |

## 3. Quyền Android V3.0

| Permission | Lý do | Mandatory? |
|---|---|---|
| INTERNET | API calls | yes |
| ACCESS_NETWORK_STATE | Offline detect | yes |
| FOREGROUND_SERVICE | Background sync | yes |
| CAMERA | Log photo + QR scan | optional |
| ACCESS_FINE_LOCATION | GPS stamp + Geofence | **optional** (V1.1+V1.3) |
| ACCESS_BACKGROUND_LOCATION | Geofence khi background | **optional** (V1.3, opt-in) |
| USE_BIOMETRIC | Login vân tay | optional |
| POST_NOTIFICATIONS | Local notification | optional |
| REQUEST_INSTALL_PACKAGES | OTA APK | optional |
| READ_MEDIA_IMAGES | Gallery | optional |

**App KHÔNG truy cập:** contacts, calendar, SMS, microphone, cuộc gọi.

## 4. Bảo mật

- JWT token mã hóa Android Keystore.
- Biometric **100% local** — Android BiometricPrompt, KHÔNG gửi vân tay đi đâu.
- HTTPS bắt buộc khi Cloud, HTTP cleartext chỉ cho LAN nội bộ.
- GPS không gửi liên tục, chỉ stamp khi user submit log.
- **Không có analytics SDK bên thứ 3.**

## 5. Bên thứ 3 V3.0

| Service | Mục đích | Data gửi đi |
|---|---|---|
| Server riêng (WLC + GAS) của user | Backend chính | Tất cả (do user quản lý) |
| OpenWeather (V1.2, optional) | Weather forecast | lat/lng của vị trí xem, API key của user |
| GitHub Releases API (V1.2) | OTA check | KHÔNG có data cá nhân |

User có thể **tắt hoàn toàn** OpenWeather + OTA bằng cách không cấu hình API key + repo.

## 6. Xoá data

- Logout → xoá JWT
- Settings → Xoá queue → xoá data offline
- Uninstall → xoá tất cả device data
- Xoá data server: yêu cầu trực tiếp admin nông trại

## 7. Liên hệ

- Email: kd.ecosyntech@gmail.com
- Đại diện pháp lý: CEO Thuận, EcoSynTech Global
- Privacy Policy URL: https://github.com/ecosyntech-global/farmos-mobile/blob/main/PRIVACY_POLICY.md

**Update V3.0:** Bổ sung GPS, Biometric, OpenWeather, GitHub OTA, Local Notification.
