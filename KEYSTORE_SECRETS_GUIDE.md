# GitHub Secrets — Keystore setup cho Release workflow

> CEO làm 1 lần trước lần tag release đầu tiên.  
> Time: ~10 phút.

## Tại sao cần secrets?

Workflow `release-android.yml` build signed APK + AAB. Để ký bundle, GitHub Actions cần keystore + password. Không thể commit keystore vào repo (security). Giải pháp: lưu trong GitHub Secrets, decode khi build.

## 4 secrets cần add

| Tên secret | Giá trị | Source |
|---|---|---|
| `KEYSTORE_BASE64` | Base64 encode toàn bộ file `farmos-release.jks` | (xem bên dưới) |
| `KEYSTORE_PASSWORD` | Password keystore (VD `changeMe123`) | Khi CEO chạy `gen-keystore.bat` |
| `KEY_ALIAS` | Alias key (VD `farmos`) | Default trong `gen-keystore.bat` |
| `KEY_PASSWORD` | Password của key (thường giống `KEYSTORE_PASSWORD`) | Khi CEO chạy `gen-keystore.bat` |

## Bước 1 — Encode keystore thành base64

Trên máy Windows CEO:

```powershell
# PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("D:\ECOSYNTECHGLOBAL2026\FarmOS-Mobile\farmos-release.jks")) | clip
```

→ Base64 string đã copy vào clipboard.

Hoặc cmd:
```bat
certutil -encode farmos-release.jks farmos-release.b64
notepad farmos-release.b64
```
→ Copy nội dung (BỎ dòng `-----BEGIN/END CERTIFICATE-----` ở đầu/cuối).

## Bước 2 — Add secrets trên GitHub

1. Vào repo: https://github.com/ecosyntech68vn/Farm-OS-App
2. **Settings** → **Secrets and variables** → **Actions**
3. Bấm **New repository secret**
4. Add lần lượt 4 secret:

### Secret 1: `KEYSTORE_BASE64`
- Name: `KEYSTORE_BASE64`
- Value: paste base64 string từ bước 1 (rất dài, ~3-5KB)
- Save

### Secret 2: `KEYSTORE_PASSWORD`
- Name: `KEYSTORE_PASSWORD`
- Value: password CEO đã chọn (mặc định `changeMe123`)
- Save

### Secret 3: `KEY_ALIAS`
- Name: `KEY_ALIAS`
- Value: `farmos`
- Save

### Secret 4: `KEY_PASSWORD`
- Name: `KEY_PASSWORD`
- Value: thường giống `KEYSTORE_PASSWORD` (mặc định `changeMe123`)
- Save

## Bước 3 — Verify

Sau khi add đủ 4 secrets:
1. Tab **Actions** → trigger workflow `Release Android APK/AAB` (Run workflow button)
2. Hoặc push tag: `git tag v3.0.0-rc1 && git push --tags`
3. Wait ~10 phút
4. Nếu workflow PASS → có Artifacts + GitHub Release với 3 file APK/AAB

## Troubleshoot

| Lỗi log | Fix |
|---|---|
| `KEYSTORE_BASE64 secret missing` | Chưa add secret → check name chính xác |
| `keytool error: Keystore was tampered with, or password incorrect` | `KEYSTORE_PASSWORD` sai |
| `Keystore was tampered with` | Base64 encode có ký tự thừa → re-encode |
| `Cannot recover key` | `KEY_PASSWORD` sai |
| Build PASS nhưng AAB unsigned | Secrets không được load → check workflow logs |

## Phase 2 (defer) — Auto-publish CH Play

Khi CEO có Play Console + Service Account JSON:

Add thêm secret:
- `CHPLAY_SERVICE_ACCOUNT_JSON`: paste full JSON content

Thêm step trong workflow:
```yaml
- name: Deploy to Play Store Internal track
  uses: r0adkll/upload-google-play@v1
  with:
    serviceAccountJsonPlainText: ${{ secrets.CHPLAY_SERVICE_ACCOUNT_JSON }}
    packageName: vn.ecosyntech.farmos
    releaseFiles: dist/farmos-*-release.aab
    track: internal
```

→ Mỗi push tag tự động upload AAB lên Play Console internal track.

## Security checklist

- ✅ Keystore file `farmos-release.jks` KHÔNG commit (đã có trong `.gitignore`)
- ✅ Passwords KHÔNG hardcode trong workflow yml
- ✅ Secrets chỉ accessible từ workflow của repo này
- ✅ Backup keystore + password vào 2 nơi external (USB + cloud private)
- ⚠️ Mất keystore = app không update CH Play được → backup là MUST
