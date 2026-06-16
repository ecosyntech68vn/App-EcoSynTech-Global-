# V5 — Giao thức điều khiển App ↔ Thiết bị (rút từ FW9.4)

## Kiến trúc (3 lớp)
```
[App FarmOS-Mobile]  --HTTP (LAN)-->  [Local-Core gateway @ trại]  --MQTT-->  [ESP32 / PCB V8.2]
   control.js                          mosquitto + API + DEVICE_SECRET            relay_safety
   offline queue (sync.js)             ký HMAC lệnh, dedup cmd_id                  rule_engine
```
- **Local-Core** giữ DEVICE_SECRET + ký lệnh. App KHÔNG giữ secret (an toàn).
- Offline-first: app mất mạng → queue; Local-Core mất mạng → ESP32 vẫn chạy rule nội bộ.

## MQTT topics (FW9.4, config.h) — `<id>` = DEVICE_ID
| Hướng | Topic | Nội dung |
|---|---|---|
| Local-Core → ESP32 | `ecosyntech/cmd/<id>` | lệnh (JSON ký HMAC), QoS1 |
| ESP32 → Local-Core | `ecosyntech/ack/<id>` | kết quả lệnh |
| ESP32 → Local-Core | `ecosyntech/telemetry/<id>` | cảm biến |
| ESP32 → Local-Core | `ecosyntech/kpi/<id>` · `ecosyntech/diag/<id>` | KPI / chẩn đoán |

## Schema lệnh (payload `cmd/<id>`)
Bắt buộc mọi lệnh: `signature` (HMAC-SHA256 hex của canonical-JSON với DEVICE_SECRET), `_ts` (epoch, trong NONCE_WINDOW_SEC), `cmd_id` (duy nhất, chống duplicate).

| action | tham số | ý nghĩa |
|---|---|---|
| `relay` | `idx`:0–7, `value`:0\|1 | bật/tắt relay (qua relay_safety: license, min_on/off, interlock, lockout, **ac_forbidden**) |
| `rule_set` | idx, sensor, op, min, max, hysteresis, duration_sec, cooldown_sec, relay_idx, on_fire, hour_start/end, min_on_sec, min_off_sec, on_fail, keep_failsafe | đặt luật tự động |
| `rule_clear` | idx | xoá luật |
| `relay_storm_action` | idx:1–7, act:0\|1\|2 | hành vi relay khi bão |
| `relay_load_tag` | idx, ac:0\|1 | khai báo tải AC/DC |
| `sample_now` / `config_pull_now` / `ota_now` / `ota_rollback` / `emergency_off` / `emergency_clear` / `wifi_reset` / `diag_run` / `heal_run` | — | lệnh hệ thống |

## ACK (`ack/<id>`)
`{cmd_id, action, status: "completed"|"rejected"|"deferred", reason}`
Lý do relay bị từ chối: `bad_idx, disabled, lockout, emergency, interlock, min_on, min_off, rate, mutex, ac_forbidden`.

## ⚠️ AN TOÀN — AC Load Guard (FW V9.4.3)
- PCB V8.0/V8.1: creepage AC↔LV **0.96mm < 3mm (IEC 60664-1)** → FW **CẤM tải AC**, chỉ DC ≤24V. `relay_load_tag ac=1` → relay khoá đến khi **lên V8.2**.
- → **V8.2 (vừa đặt) là bản dự kiến CHO PHÉP tải AC.** Cần verify layout V8.2 đạt creepage ≥3mm trước khi cho phép AC trong app/Local-Core.

## Ánh xạ UI hiện tại → relay idx (cần chốt khi tích hợp)
`control.js` đang dùng action trừu tượng (`pump_on`, `light_on`). V5 cần map: pump/light/… → `relay idx` cụ thể theo cấu hình trại (lưu trong device profile).

## QUYẾT ĐỊNH CẦN CEO chốt (trước khi code Phase 1)
1. **Local-Core gateway đã có chưa?** (mosquitto + API + device-secret chạy ở đâu tại trại — Raspberry Pi? mini-PC? hay tích hợp vào chính ESP32?)
2. **App điều khiển qua Local-Core (HTTP/LAN, khuyến nghị — secret nằm ở gateway) hay app nói MQTT trực tiếp tới ESP32** (app phải giữ secret — kém an toàn hơn)?
3. **Provisioning**: app ghép nối thiết bị thế nào (QR pairing cấp endpoint + token)?
