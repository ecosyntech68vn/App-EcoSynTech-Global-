# dist/ V3.0 — Build outputs

3 file sẽ xuất hiện sau khi CEO chạy `scripts\build-all-v3.bat`:

| File | Mục đích | Size dự kiến V3.0 |
|---|---|---|
| `farmos-v3.0.0-debug.apk` | Cài máy test, có debug bridge | ~18-22 MB |
| `farmos-v3.0.0-release.apk` | Cài máy user thật, signed | ~14-18 MB |
| `farmos-v3.0.0-release.aab` | Upload CH Play Console | ~14-18 MB |

Size V3.0 lớn hơn V1.0 (~10-12MB) vì có thêm Chart.js + jsPDF + 5 plugin Capacitor mới.

## Note quan trọng

- Folder hiện rỗng vì sandbox build không có Android SDK.
- CEO chạy build trên Windows có Android Studio đã cài sẵn.
- Trước build: chạy `scripts\gen-keystore.bat` 1 lần nếu chưa có `farmos-release.jks`.
- Sau cap add android lần đầu: merge templates manifest + file_paths + build.gradle snippet.

Xem `BUILD_FROM_SOURCE_V3.md` cho hướng dẫn đầy đủ.
