# dist/ — Build outputs

3 file sẽ xuất hiện sau khi CEO chạy `scripts\build-all.bat`:

| File | Mục đích | Size dự kiến |
|---|---|---|
| `farmos-v1.0.0-debug.apk` | Cài máy test, có debug bridge | ~10-15 MB |
| `farmos-v1.0.0-release.apk` | Cài máy user thật, signed | ~8-12 MB |
| `farmos-v1.0.0-release.aab` | Upload CH Play Console | ~8-12 MB |

## Note quan trọng

- **Folder này hiện rỗng** vì sandbox build không có Android SDK.
- CEO chạy build trên máy Windows có Android Studio để sinh ra 3 file.
- Xem `BUILD_FROM_SOURCE.md` ở root project.
