# CI/CD Setup Report — FarmOS-Mobile V3.0

> **Date:** 2026-06-10 · **Owner:** CEO Thuận · **Repo:** https://github.com/ecosyntech68vn/Farm-OS-App

## 1. Tóm tắt

Em đã setup đầy đủ CI/CD pipeline cho repo `Farm-OS-App`. Code FarmOS-Mobile V3.0 đã được **commit ready-to-push** (83 file, hash `92e7bb7`). Em chuẩn bị 3 cách push để CEO chọn cách phù hợp nhất.

## 2. Deliverables

| Item | Path | Status |
|---|---|---|
| `.gitignore` (57 dòng, loại trừ keystore/secrets/build artifacts) | `.gitignore` | ✅ |
| CI workflow (web build + JS syntax check) | `.github/workflows/ci.yml` | ✅ YAML valid |
| Release workflow (signed APK + AAB + GitHub Release) | `.github/workflows/release-android.yml` | ✅ YAML valid |
| Keystore secrets guide | `KEYSTORE_SECRETS_GUIDE.md` | ✅ |
| Repo setup runbook 4 bước CEO | `REPO_SETUP.md` | ✅ |
| Init+push script | `scripts/git-init-push.bat` | ✅ |
| Tag release script | `scripts/git-tag-release.bat` | ✅ |
| Bundle-based push (alternative) | `scripts/git-push-from-bundle.bat` | ✅ |
| Prebuilt git bundle (83 files, commit `92e7bb7`) | `dist/farmos-v3.0.0.bundle` (1.5 MB) | ✅ |

## 3. 3 cách CEO push code lên GitHub

### Cách A — Init mới + push (đơn giản nhất)
```bat
cd D:\ECOSYNTECHGLOBAL2026\FarmOS-Mobile
scripts\git-init-push.bat
```
Khi git hỏi credentials: paste **PAT GitHub** (không phải password thật).

### Cách B — Restore từ bundle + push
Em đã commit sẵn 83 file vào bundle `dist/farmos-v3.0.0.bundle`. CEO chỉ cần:
```bat
cd D:\ECOSYNTECHGLOBAL2026\FarmOS-Mobile
scripts\git-push-from-bundle.bat
```
Nhanh hơn (skip add+commit) — chỉ cần auth + push.

### Cách C — Push thủ công qua GitHub web (chậm, không khuyến khích)
- Upload từng folder qua web UI — quá nhiều file (83 file, 8 thư mục con)
- Chỉ dùng nếu CEO không cài git được

→ **Khuyến nghị Cách A** cho lần đầu.

## 4. CI/CD workflow logic

### `ci.yml` — chạy mỗi push/PR
1. Setup Node 20
2. `npm ci --legacy-peer-deps`
3. Lint + Test (nếu có, optional)
4. `npm run build` (Capacitor target — production)
5. `CAP_BROWSER=1 npm run build` (browser shim — verify dev mode)
6. Upload `www/` artifact (retention 7 ngày)
7. Job song song: node syntax check tất cả `src/**/*.js` + `vite.config.js`

→ Run time ~3-4 phút.

### `release-android.yml` — chạy khi push tag `v*` hoặc manual trigger
1. Setup Node 20 + Java 17 + Android SDK 34
2. `npm ci` + `npm run build` + `cap add android` + `cap sync`
3. Merge templates manifest/file_paths
4. **Decode keystore** từ secret `KEYSTORE_BASE64`
5. Build `assembleDebug` (unsigned)
6. Build `assembleRelease` (signed nếu có secrets)
7. Build `bundleRelease` (signed AAB)
8. Rename theo version tag: `farmos-v3.0.0-debug.apk`, `-release.apk`, `-release.aab`
9. Upload artifacts (retention 30 ngày)
10. **Tạo GitHub Release** với 3 file đính kèm + release notes auto-generate

→ Run time ~8-12 phút (Android Gradle build chậm).

## 5. CEO làm 4 bước (30 phút)

### Bước 1 — Tạo PAT GitHub (5 phút)
1. https://github.com/settings/tokens
2. Generate new token (classic) → expires 90 days
3. Scope tick: `repo`
4. Generate → copy ngay
5. Lưu password manager

### Bước 2 — Push code lần đầu (5 phút)
```bat
cd D:\ECOSYNTECHGLOBAL2026\FarmOS-Mobile
scripts\git-init-push.bat
```
Paste PAT khi git hỏi password.

### Bước 3 — Add 4 GitHub Secrets (10 phút)
Follow `KEYSTORE_SECRETS_GUIDE.md`:
- Tạo keystore: `scripts\gen-keystore.bat` (nếu chưa có)
- Encode base64: PowerShell `[Convert]::ToBase64String(...) | clip`
- Add tại https://github.com/ecosyntech68vn/Farm-OS-App/settings/secrets/actions:
  - `KEYSTORE_BASE64`
  - `KEYSTORE_PASSWORD`
  - `KEY_ALIAS`
  - `KEY_PASSWORD`

### Bước 4 — Tag release v3.0.0 (1 lệnh)
```bat
scripts\git-tag-release.bat v3.0.0
```
Wait ~10 phút → https://github.com/ecosyntech68vn/Farm-OS-App/releases có v3.0.0 với 3 file APK/AAB.

## 6. Verify trong sandbox em đã làm

| Verify | Result |
|---|---|
| `.gitignore` không leak secret/keystore | ✅ — chỉ track `KEYSTORE_SECRETS_GUIDE.md` (doc) |
| YAML `ci.yml` valid syntax (Python yaml.safe_load) | ✅ PASS |
| YAML `release-android.yml` valid | ✅ PASS |
| Git init + add + commit ở `/tmp/farmos-repo` | ✅ 83 file committed, hash `92e7bb7` |
| Workflow chạy thử | ❌ Không thể test sandbox (cần GitHub runner) — CEO push lên xem actual |
| Bundle integrity (`git bundle verify`) | ✅ Records complete history |

## 7. Stop conditions

| Trigger | Hành động |
|---|---|
| Push fail "Authentication failed" | PAT expired/sai → regenerate |
| Workflow CI fail | Đọc log → em fix YAML/script |
| Workflow Release fail ở "Decode Keystore" | Chưa add `KEYSTORE_BASE64` secret |
| Workflow Release fail ở "assembleRelease" | Password sai trong secrets |
| GitHub Release rỗng | Phải push **tag** (không phải branch): `git push origin v3.0.0` |
| Bị limit GitHub Actions minutes (free tier 2000/tháng) | Cache npm + gradle, tắt workflow non-essential |

## 8. Phase 2 (defer khi CEO có Play Console)

Khi có Service Account JSON từ Play Console:
- Add secret `CHPLAY_SERVICE_ACCOUNT_JSON`
- Em update `release-android.yml` thêm step `r0adkll/upload-google-play@v1`:
  ```yaml
  - uses: r0adkll/upload-google-play@v1
    with:
      serviceAccountJsonPlainText: ${{ secrets.CHPLAY_SERVICE_ACCOUNT_JSON }}
      packageName: vn.ecosyntech.farmos
      releaseFiles: dist/farmos-*-release.aab
      track: internal
  ```
- Mỗi tag → 15 phút sau AAB lên Play Console Internal track.

## 9. Security posture

- ✅ Keystore `*.jks` ignored bởi `.gitignore`
- ✅ Passwords trong workflow chỉ qua `${{ secrets.* }}`, không hardcode
- ✅ Bundle 1.5 MB không chứa keystore/secrets (verified `git ls-files | grep` không match)
- ✅ PAT scope chỉ `repo` (không grant ngoài tầm cần)
- ⚠️ CEO phải backup `farmos-release.jks` + password vào 2 nơi external (mất = app không update CH Play được)
- ⚠️ Rotate PAT mỗi 90 ngày (GitHub recommend)

## 10. Honest constraints

- Em **không thể tự push** lên repo CEO vì sandbox không có GitHub credentials. CEO chạy `git-init-push.bat` 1 lệnh là xong.
- Em **không thể test workflow runtime** — phải đợi CEO push để GitHub Actions chạy.
- Nếu workflow fail lần đầu, gửi em log → em fix YAML.
- Em chuẩn bị sẵn **bundle 1.5MB ở dist/** để CEO có thể push cách B nếu cách A fail.

## 11. Sign-off

- ✅ 4/4 STEP CI/CD setup done
- ✅ YAML hợp lệ verified
- ✅ Git bundle integrity OK
- ✅ 3 script .bat sẵn sàng
- ✅ 4 doc đầy đủ (REPO_SETUP, KEYSTORE_SECRETS_GUIDE, this report, scripts comments)

CEO chỉ cần ~30 phút thực thi 4 bước. GO push.

---

**END CI/CD REPORT** · 2026-06-10
