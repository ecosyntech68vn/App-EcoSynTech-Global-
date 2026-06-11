# Repo Setup — Push code lên GitHub + CI/CD

> CEO làm 4 bước, tổng ~30 phút (lần đầu).

## Tổng quan

Repo target: **https://github.com/ecosyntech68vn/Farm-OS-App**

Sau khi setup xong, mọi commit push sẽ:
- `push main` → CI build verify Vite + JS syntax (3 phút)
- `push tag v*` → build signed APK + AAB → GitHub Release tự động (~10 phút)

## Bước 1 — Init git + push lần đầu (~10 phút)

Trên máy Windows CEO, mở terminal tại `D:\ECOSYNTECHGLOBAL2026\FarmOS-Mobile\`:

```bat
cd D:\ECOSYNTECHGLOBAL2026\FarmOS-Mobile
scripts\git-init-push.bat
```

Script này:
1. Init git repo riêng (KHÔNG đụng .git ngoài của ECOSYNTECHGLOBAL2026)
2. Add tất cả file theo `.gitignore`
3. Commit "feat: initial release FarmOS-Mobile V3.0 — 18 features"
4. Set remote origin = `https://github.com/ecosyntech68vn/Farm-OS-App.git`
5. Push branch main

Khi git prompt credentials:
- Username: `ecosyntech68vn` (hoặc username GitHub của CEO)
- Password: **Personal Access Token (PAT)** — KHÔNG dùng password GitHub thật

### Tạo PAT nếu chưa có
1. Github → Settings (icon avatar) → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token (classic) → expires 90 days
3. Scopes: tick `repo` (full control of private repos)
4. Generate → **copy ngay token** (không xem lại được)
5. Save vào password manager (1Password / Bitwarden / file .env local KHÔNG commit)

## Bước 2 — Add 4 GitHub Secrets (~10 phút)

Follow `KEYSTORE_SECRETS_GUIDE.md`:
- `KEYSTORE_BASE64`
- `KEYSTORE_PASSWORD`
- `KEY_ALIAS`
- `KEY_PASSWORD`

## Bước 3 — Tag v3.0.0 → trigger build (~10 phút)

```bat
cd D:\ECOSYNTECHGLOBAL2026\FarmOS-Mobile
git tag -a v3.0.0 -m "Release V3.0.0 — 18 features"
git push origin v3.0.0
```

Wait GitHub Actions chạy:
- https://github.com/ecosyntech68vn/Farm-OS-App/actions
- Workflow `Release Android APK/AAB` ~10 phút
- Khi PASS → tab Releases có `v3.0.0` với 3 file APK/AAB

## Bước 4 — Download APK/AAB từ GitHub Release

1. Vào https://github.com/ecosyntech68vn/Farm-OS-App/releases
2. Bấm vào release `v3.0.0`
3. Download:
   - `farmos-v3.0.0-debug.apk` (cài máy test)
   - `farmos-v3.0.0-release.apk` (cài user thật, signed)
   - `farmos-v3.0.0-release.aab` (upload CH Play)

## Troubleshoot

| Lỗi | Fix |
|---|---|
| `Authentication failed` khi push | PAT hết hạn / sai → regenerate, dùng PAT làm password |
| `remote: Repository not found` | Tên repo sai, check `git remote -v` |
| Workflow chạy fail ở "Decode Keystore" | Chưa add secret `KEYSTORE_BASE64` |
| Workflow fail ở "assembleRelease" | Keystore password sai → check 4 secrets |
| GitHub Release rỗng | Workflow chạy không phải từ tag — phải `git push origin TAGNAME` |
| Tag tạo nhầm version | `git tag -d vX && git push origin :refs/tags/vX` để xoá |

## Workflow trigger summary

| Action | Trigger workflow | Time |
|---|---|---|
| `git push main` | CI Build & Test | ~3 phút |
| `git push origin v3.0.0` (tag) | Release Android APK/AAB | ~10 phút |
| Manual trigger Actions tab | Cả 2 | tuỳ |
| PR vào main | CI Build & Test | ~3 phút |

## Next steps (defer Phase 2)

Khi CEO có Play Console + Service Account JSON:
- Add secret `CHPLAY_SERVICE_ACCOUNT_JSON`
- Em update workflow thêm step `r0adkll/upload-google-play@v1`
- Mỗi tag tự upload AAB → Play Console Internal track

→ Push tag → 15 phút sau app có trên Play Console internal testing.
