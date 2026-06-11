# TRACE LANDING V1.0 — DEPLOY (5 phút)

## Test ngay trên máy (không cần deploy)
Mở `index.html` bằng Chrome → thêm `?demo=1` vào URL → xem hồ sơ mẫu.

## Deploy Cloudflare Pages (free, khuyến nghị — đã có hạ tầng từ 2026-06-04)
1. Tạo project Pages mới → upload 2 file `index.html` + `logo.png` (hoặc trỏ repo).
2. Cấu hình redirect SPA: tạo file `_redirects` nội dung: `/t/* /index.html 200`
3. Gắn custom domain `trace.ecosyntech.vn` (DNS CNAME → pages.dev).

## Sau deploy — hoạt động ngay
- QR từ app V3.1 đã nhúng payload `#d=` → quét ra hồ sơ thật **không cần backend**.
- Khi GAS có action `trace` (P1, spec trong ECOSYSTEM_STATE_2026-06-11.md §3.6) → tự nâng cấp thành badge "Đã xác minh máy chủ", không phải sửa page (URL GAS đã bake sẵn).

## Nếu dùng domain khác
Đổi base URL QR trong app: `authStore.traceBaseUrl = 'https://<domain>/t/'` (Settings roadmap) hoặc sửa default trong `src/db/trace.js`.
