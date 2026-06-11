# CH Play Console — Publish Checklist (CEO làm trong 30 phút)

> Sau khi CEO chạy build (3 file APK/AAB ở `dist/`), follow checklist này để publish.

## Pre-publish (1 lần)

- [ ] **Tạo Play Console account** — https://play.google.com/console/signup
  - Phí: $25 (1 lần, không recurring)
  - Cần Google account `kd.ecosyntech@gmail.com`
  - Verify danh tính (CMND/passport)
  - Thời gian xét: 24-48h

- [ ] **Host Privacy Policy** — upload `PRIVACY_POLICY.md` lên GitHub Pages
  - Repo: tạo `ecosyntech-global/farmos-mobile` (public)
  - File: `PRIVACY_POLICY.md` ở root
  - Setting Pages → branch main → Save
  - URL public: `https://ecosyntech-global.github.io/farmos-mobile/PRIVACY_POLICY`

## Create app trên Play Console

- [ ] Vào Play Console → "Create app"
- [ ] App name: `EcoSynTech Farm OS`
- [ ] Default language: Vietnamese
- [ ] App or game: **App**
- [ ] Free or paid: **Free**
- [ ] Confirm 2 declaration: Developer Program Policies + US export laws

## App content (mandatory questionnaire)

- [ ] **Privacy Policy URL** → paste link GitHub Pages
- [ ] **App access** → "All functionality available without restrictions"
  - Hoặc nếu test với credentials: paste credentials vào "Sample login credentials"
- [ ] **Ads** → **No** ads
- [ ] **Content rating** → fill từ `RATING_ANSWERS.md` → expected **Everyone**
- [ ] **Target audience** → 18+ → Not designed for children
- [ ] **News app** → **No**
- [ ] **COVID-19** → **No** (V1.0 không có)
- [ ] **Data safety** → fill form theo `LISTING_FIELDS.md` section "Data safety form"
- [ ] **Government app** → **No**
- [ ] **Financial features** → **No**

## Store listing

- [ ] App name: `EcoSynTech Farm OS`
- [ ] Short description: copy từ `DESCRIPTION_VI.md` (80 chars)
- [ ] Full description: copy phần đầy đủ từ `DESCRIPTION_VI.md`
- [ ] App icon: upload `icon-512.png`
- [ ] Feature graphic: upload `feature-1024x500.png`
- [ ] Phone screenshots: upload 6 file từ `screenshots/01-login.png` → `06-settings.png`
- [ ] App category: **Productivity**
- [ ] Email: `kd.ecosyntech@gmail.com`
- [ ] Website: `https://ecosyntech.vn`

Optional:
- [ ] Promo video YouTube (V1.1)
- [ ] Tablet screenshots (skip V1.0)

## Translations (EN)

- [ ] Add language: English (US)
- [ ] Short + full description: copy từ `DESCRIPTION_EN.md`
- [ ] Reuse icon/feature/screenshots (giống vi)

## Upload AAB

- [ ] Production → "Create new release"
- [ ] Upload `dist/farmos-v1.0.0-release.aab`
- [ ] Release name: `1.0.0 — Initial release`
- [ ] Release notes (vi):
  ```
  • Phát hành đầu tiên
  • 6 màn hình core: Login, Sensor Dashboard, Alert, Log, Task, Settings
  • Offline-first với auto-sync khi có mạng
  • Auto-fallback LAN → Cloud
  ```
- [ ] Release notes (en):
  ```
  • Initial release
  • 6 core screens: Login, Sensor Dashboard, Alert, Log, Task, Settings
  • Offline-first with auto-sync when online
  • Auto-fallback LAN → Cloud
  ```

## Countries

- [ ] Select **Vietnam only** cho V1.0 (giảm risk + dễ support)
- [ ] V1.2 mở rộng SEA: TH, ID, PH, MY

## Review + Submit

- [ ] Bấm "Review release"
- [ ] Check warnings (target SDK, permissions, etc.)
- [ ] Bấm "Start rollout to Production"
- [ ] Google review: 1-7 ngày (lần đầu thường 3-5 ngày)

## Track sau publish

- [ ] Watch "App rating" → nếu <3.5 trong 30 ngày đầu → debug ngay
- [ ] Watch "Android vitals" → crash rate target <1%
- [ ] Watch "Reviews" → trả lời từng review trong 24h
- [ ] Track installs → expected 10-50 đầu tiên là EcoSynTech team + farmer pilot

## Update sau

- [ ] Khi có V1.0.1 (bug fix): tăng `versionCode` lên 2 trong `android/app/build.gradle`, build lại AAB, upload
- [ ] Notes: chỉ tăng versionCode (số nguyên), versionName giữ semver

## Risk + checklist cuối

| Risk | Mitigation |
|---|---|
| Bị reject vì missing privacy policy | ✅ Đã có, host GitHub Pages trước |
| Bị reject vì Data Safety không khớp permission | ✅ Đã khai sát: camera (photo for log) |
| Bị reject vì sensitive permission lạm dụng | ✅ Chỉ camera, có giải thích trong description |
| User cài app báo "không cài được" | Verify min SDK 26 (Android 8.0+), test phone CEO trước |
| Lỡ tay xoá keystore → app không update | ✅ BACKUP `farmos-release.jks` + password vào 2 nơi |

---

**ETA total CEO:** 30 phút (sau khi đã có Play Console account verified).
