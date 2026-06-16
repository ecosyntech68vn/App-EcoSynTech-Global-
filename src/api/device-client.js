// device-client.js — V5 Track A: điều khiển ESP32 (PCB V8.2) qua LAN HTTP.
// Kiến trúc: App → ESP32 (tự gateway, HTTP trên LAN) → relay_safety.
// Bảo mật: mỗi lệnh ký HMAC-SHA256(secret, `${cmdId}.${ts}.${rawBody}`); ESP32 verify.
// Offline-first: ESP32 không với tới → enqueue (syncQueue) để gửi lại.
//
// Pairing (QR khi lắp đặt) lưu: { deviceId, ip, secret }. secret → secureStore (mã hoá).
// FW9.5 cần thêm endpoint: GET /api/status, POST /api/relay, POST /api/rule, POST /api/cmd.

import { get, set } from 'idb-keyval';
import { secureStore } from '../stores/secure.js';
import { syncQueue } from '../stores/sync.js';

const CFG_KEY = 'device:cfg';            // { deviceId, ip } (không nhạy cảm)
const SECRET_KEY = (id) => `devsecret:${id}`;
const HTTP_TIMEOUT_MS = 4000;

// ---------- pairing / config ----------
export async function pairDevice({ deviceId, ip, secret }) {
  if (!deviceId || !ip || !secret) throw new Error('pairDevice: thiếu deviceId/ip/secret');
  await secureStore.set(SECRET_KEY(deviceId), secret);
  await set(CFG_KEY, { deviceId, ip });
  return { deviceId, ip };
}
export async function getDeviceCfg() { return (await get(CFG_KEY)) || null; }
export async function isPaired() { const c = await getDeviceCfg(); return !!(c && c.ip && c.deviceId); }

// ---------- HMAC-SHA256 (Web Crypto) ----------
function hex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function hmacHex(secret, msg) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}
function newCmdId() {
  return 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// ---------- low-level signed request ----------
async function signedFetch(path, bodyObj) {
  const cfg = await getDeviceCfg();
  if (!cfg) throw new Error('Chưa ghép nối thiết bị (chưa pair).');
  const secret = await secureStore.get(SECRET_KEY(cfg.deviceId));
  if (!secret) throw new Error('Thiếu device-secret (ghép nối lại).');

  const cmdId = newCmdId();
  const ts = Math.floor(Date.now() / 1000);
  const rawBody = JSON.stringify(bodyObj || {});
  const sig = await hmacHex(secret, `${cmdId}.${ts}.${rawBody}`);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(`http://${cfg.ip}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Cmd-Id': cmdId, 'X-Ts': String(ts), 'X-Sig': sig },
      body: rawBody,
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data, cmdId };
  } finally {
    clearTimeout(timer);
  }
}

// ---------- public API (mirror FW MQTT actions) ----------

// Bật/tắt relay thật. value: true=ON. Trả {status:'completed'|'rejected', reason}.
export async function setRelay(idx, value, { queueIfOffline = true } = {}) {
  const body = { action: 'relay', idx: Number(idx), value: value ? 1 : 0 };
  try {
    const r = await signedFetch('/api/relay', body);
    if (!r.ok) return { status: 'error', reason: 'http_' + r.status };
    // ESP32 trả {status, reason} từ relay_safety (vd ac_forbidden, lockout...)
    return { status: r.data.status || 'completed', reason: r.data.reason || '', cmdId: r.cmdId };
  } catch (e) {
    if (queueIfOffline) {
      const cfg = await getDeviceCfg();
      await syncQueue.enqueue({ path: `/api/relay`, method: 'POST', body, device: cfg && cfg.deviceId, kind: 'relay' });
      return { status: 'queued', reason: 'offline' };
    }
    return { status: 'error', reason: String(e.message || e) };
  }
}

// Đọc trạng thái: relays + cảm biến + ac_permitted + fw. Có cache để xem offline.
const STATUS_CACHE = 'device:status';
export async function getStatus() {
  const cfg = await getDeviceCfg();
  if (!cfg) return { online: false, paired: false };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(`http://${cfg.ip}/api/status`, { signal: ctrl.signal });
    const data = await res.json();
    await set(STATUS_CACHE, { data, ts: Date.now() });
    return { online: true, paired: true, ...data };
  } catch (_) {
    const c = await get(STATUS_CACHE);
    return { online: false, paired: true, fromCache: !!c, ts: c && c.ts, ...(c ? c.data : {}) };
  } finally {
    clearTimeout(timer);
  }
}

// Đặt/xoá luật tự động (rule_engine). rule = schema FW (sensor, op, min, max, relay_idx, ...).
export async function setRule(rule) { return signedFetch('/api/rule', { action: 'rule_set', ...rule }); }
export async function clearRule(idx) { return signedFetch('/api/rule', { action: 'rule_clear', idx: Number(idx) }); }

// Lệnh hệ thống (sample_now, emergency_off, diag_run, ...).
export async function sysCmd(action, params = {}) { return signedFetch('/api/cmd', { action, ...params }); }
