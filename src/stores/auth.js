// Auth store V3.1 — JWT + URL + biometric + multi-role + multi-farm
// V3.0.1 — Offline-first PIN: seed default PIN, local fallback when network fails
// V3.1 FIX #2 — token/refresh/PIN-hash chuyển sang SecureStorage (Android Keystore-backed).
//               Preferences chỉ còn config KHÔNG nhạy cảm. Tự migrate từ V3.0 và xoá bản plaintext.
// V3.1 FIX #3 — TLS policy: cloud bắt buộc HTTPS; HTTP chỉ chấp nhận host LAN private.
import { Preferences } from '@capacitor/preferences';
import { secureStore } from './secure.js';

const KEY = 'auth_v3';            // legacy blob V3.0 (migrate rồi xoá)
const CFG_KEY = 'auth_cfg_v31';   // config không nhạy cảm
const PIN_KEY = 'auth_v3_pin';    // legacy PIN hash trong Preferences (migrate rồi xoá)
const PIN_SECURE_KEY = 'pin_hash';
const DEFAULT_PIN = '1234';
const PIN_SALT = 'ecosyntech-farmos-v3-pin-salt-2026';
const LOGIN_TIMEOUT_MS = 6000; // 6s timeout — fail fast if server unreachable

let _pinRecordCache = null; // RAM cache tránh gọi SecureStorage liên tục

const PRIVATE_HOST_RE = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

// FIX #3 — chặn gửi token qua kênh không mã hoá ra ngoài LAN
export function validateServerUrl(url, { isCloud = false } = {}) {
  let u;
  try { u = new URL(url); } catch { throw new Error('URL không hợp lệ'); }
  if (u.protocol === 'https:') return { ok: true, warning: null };
  if (u.protocol !== 'http:') throw new Error('Chỉ chấp nhận http/https');
  if (isCloud) throw new Error('Cloud URL bắt buộc HTTPS — không gửi token qua kênh không mã hoá');
  if (!PRIVATE_HOST_RE.test(u.hostname)) {
    throw new Error('HTTP chỉ cho phép với IP LAN nội bộ (192.168.x / 10.x / 172.16-31.x / localhost)');
  }
  return { ok: true, warning: 'LAN đang chạy HTTP không mã hoá — khuyến nghị bật TLS trên WLC' };
}

// Deterministic SHA-256(pin + salt) → hex string. WebCrypto in Capacitor/browser.
async function hashPin(pin) {
  const enc = new TextEncoder();
  const data = enc.encode(String(pin) + PIN_SALT);
  if (globalThis.crypto?.subtle) {
    const buf = await globalThis.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback (should never hit on Capacitor / modern browser)
  let h = 0;
  for (let i = 0; i < data.length; i++) { h = ((h << 5) - h) + data[i]; h |= 0; }
  return 'fb_' + (h >>> 0).toString(16);
}

function withTimeout(promise, ms) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('Server không phản hồi (timeout ' + ms + 'ms). Kiểm tra URL/mạng.')), ms);
    promise.then(v => { clearTimeout(t); res(v); })
           .catch(e => { clearTimeout(t); rej(e); });
  });
}

export const authStore = {
  token: null,    // RAM only — persist qua SecureStorage
  refresh: null,  // RAM only — persist qua SecureStorage
  url: 'http://192.168.1.100:3000',
  mode: 'local',          // V3.0.1: default LOCAL — works offline first-run, no server required
  cloudUrl: '',
  farmerId: null,
  // V1.2
  biometricEnabled: false,
  weatherApiKey: '',
  otaRepo: 'ecosyntech-global/farmos-mobile',
  // V1.3
  role: 'farmer',
  activeFarmId: null,
  permissions: [],
  // V3.1 — bật khi backend WLC có /api/lots (sync lô lên server)
  traceSyncEnabled: false,
  // V4.0 — gói dịch vụ (PRICING_PACKAGES_V1.md): base|pro|promax|premium.
  // WLC sẽ phát qua JWT; khi chưa có server, đổi trong Settings (demo/quản trị).
  plan: 'pro',
  features: [],
  // V7.0.3 — múi giờ (GMT+7 mặc định cho VN). Có thể đổi trong Settings.
  timezoneOffset: 7,

  async restore() {
    // 1. Config không nhạy cảm
    const { value: cfg } = await Preferences.get({ key: CFG_KEY });
    if (cfg) {
      try { Object.assign(this, JSON.parse(cfg)); } catch (_) {}
    }
    // 2. Secrets từ SecureStorage
    this.token = await secureStore.get('jwt');
    this.refresh = await secureStore.get('jwt_refresh');

    // 3. Migration từ blob V3.0 (token plaintext trong Preferences)
    const { value: legacy } = await Preferences.get({ key: KEY });
    if (legacy) {
      try {
        const o = JSON.parse(legacy);
        const { token: legacyToken, refresh: legacyRefresh, ...cfgOnly } = o;
        if (!cfg) Object.assign(this, cfgOnly);
        if (!this.token && legacyToken) {
          this.token = legacyToken;
          this.refresh = legacyRefresh || null;
        }
        await this.save();
        await Preferences.remove({ key: KEY }); // huỷ bản plaintext
        console.log('[auth] migrated V3.0 blob → SecureStorage + config, đã xoá plaintext');
      } catch (_) {}
    }
    // 4. Migration PIN hash → SecureStorage
    const { value: legacyPin } = await Preferences.get({ key: PIN_KEY });
    if (legacyPin) {
      const existing = await secureStore.get(PIN_SECURE_KEY);
      if (!existing) await secureStore.set(PIN_SECURE_KEY, legacyPin);
      await Preferences.remove({ key: PIN_KEY });
    }
    return !!this.token;
  },

  async save() {
    // Secrets — SecureStorage
    if (this.token) await secureStore.set('jwt', this.token);
    else await secureStore.remove('jwt');
    if (this.refresh) await secureStore.set('jwt_refresh', this.refresh);
    else await secureStore.remove('jwt_refresh');
    // Config — Preferences (KHÔNG chứa token)
    await Preferences.set({
      key: CFG_KEY,
      value: JSON.stringify({
        url: this.url,
        mode: this.mode,
        cloudUrl: this.cloudUrl,
        farmerId: this.farmerId,
        biometricEnabled: this.biometricEnabled,
        weatherApiKey: this.weatherApiKey,
        otaRepo: this.otaRepo,
        role: this.role,
        activeFarmId: this.activeFarmId,
        permissions: this.permissions,
        traceSyncEnabled: this.traceSyncEnabled,
        plan: this.plan,
        features: this.features,
        timezoneOffset: this.timezoneOffset
      })
    });
  },

  async _getPinRecord() {
    if (_pinRecordCache) return _pinRecordCache;
    const value = await secureStore.get(PIN_SECURE_KEY);
    if (value) { _pinRecordCache = value; return value; }
    // chưa migrate? đọc legacy
    const { value: legacy } = await Preferences.get({ key: PIN_KEY });
    if (legacy) _pinRecordCache = legacy;
    return legacy || null;
  },

  // V3.0.1 — Seed default PIN hash on first run. CEO/farmer can change later in Settings.
  // NO hardcoded PIN in compare logic — only the hash is stored (SecureStorage).
  async seedDefaultPinIfEmpty() {
    if (await this._getPinRecord()) return false;
    const hash = await hashPin(DEFAULT_PIN);
    const record = JSON.stringify({ hash, v: 2, seededAt: new Date().toISOString() });
    await secureStore.set(PIN_SECURE_KEY, record);
    _pinRecordCache = record;
    return true; // seeded
  },

  async isDefaultPinSeeded() {
    return !!(await this._getPinRecord());
  },

  async changePin(oldPin, newPin) {
    if (!/^[0-9]{4,6}$/.test(String(newPin))) throw new Error('PIN mới phải 4-6 chữ số');
    const value = await this._getPinRecord();
    if (!value) throw new Error('PIN chưa khởi tạo');
    let stored;
    try { stored = JSON.parse(value); } catch { throw new Error('PIN store hỏng'); }
    const oldHash = await hashPin(oldPin);
    if (oldHash !== stored.hash) throw new Error('PIN cũ không đúng');
    const hash = await hashPin(newPin);
    await secureStore.set(PIN_SECURE_KEY, JSON.stringify({ hash, v: 2, changedAt: new Date().toISOString() }));
  },

  // Local PIN verify — works fully offline. Returns minimal session for app navigation.
  async _loginLocal(pin) {
    const value = await this._getPinRecord();
    if (!value) throw new Error('PIN local chưa khởi tạo');
    let stored;
    try { stored = JSON.parse(value); } catch { throw new Error('PIN store hỏng'); }
    const inputHash = await hashPin(pin);
    if (inputHash !== stored.hash) throw new Error('PIN sai');
    // Mint a local-only session token (NOT a server JWT — server calls will fail/queue offline)
    this.token = 'local-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    this.refresh = null;
    this.farmerId = this.farmerId || 'local-farmer';
    this.role = this.role || 'farmer';
    this.permissions = this.permissions || [];
    await this.save();
    return { local: true, token: this.token };
  },

  async login({ pin, url, mode }) {
    // Validate input
    if (!/^[0-9]{4,6}$/.test(String(pin || ''))) {
      throw new Error('PIN phải 4-6 chữ số');
    }
    this.mode = mode || this.mode || 'local';

    // FIX #3 — validate URL trước khi dùng (trừ mode local thuần offline)
    if (url) {
      if (this.mode !== 'local') {
        const v = validateServerUrl(url); // server WLC: https OK, http chỉ cho LAN private
        if (v.warning) console.warn('[auth]', v.warning);
      }
      this.url = url;
    }

    // Mode 'local' — pure offline PIN, no network call
    if (this.mode === 'local') {
      await this._loginLocal(pin);
      return;
    }

    const tryFarmer = async () => {
      const r = await withTimeout(fetch(`${this.url}/api/farmer/auth/verify-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: pin, phone: 'pin-auth' })
      }), LOGIN_TIMEOUT_MS);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    };
    const tryAuth = async () => {
      const r = await withTimeout(fetch(`${this.url}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'farmer', password: pin })
      }), LOGIN_TIMEOUT_MS);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    };
    let data;
    let lastErr;
    try { data = await tryFarmer(); }
    catch (e1) {
      lastErr = e1;
      try { data = await tryAuth(); }
      catch (e2) {
        lastErr = e2;
        // V3.0.1 — if server fails AND local PIN is seeded → fall back to local login
        if (await this.isDefaultPinSeeded()) {
          try {
            await this._loginLocal(pin);
            return;
          } catch (eLocal) {
            throw new Error(`${lastErr.message}. Local PIN cũng sai: ${eLocal.message}`);
          }
        }
        throw new Error(`Không kết nối được server (${lastErr.message}). Vào Settings cấu hình URL, hoặc chọn mode Local.`);
      }
    }

    this.token = data.accessToken || data.token;
    this.refresh = data.refreshToken || data.refresh;
    this.farmerId = data.farmerId || data.userId || null;
    if (data.role) this.role = data.role;
    if (data.permissions) this.permissions = data.permissions;
    // V4.0 — server là nguồn sự thật về gói khi có
    if (data.plan) this.plan = data.plan;
    if (Array.isArray(data.features)) this.features = data.features;
    if (!this.token) throw new Error('Server không trả token');
    await this.save();
  },

  async logout() {
    this.token = null; this.refresh = null; this.farmerId = null;
    this.role = 'farmer'; this.permissions = [];
    await secureStore.remove('jwt');
    await secureStore.remove('jwt_refresh');
    await Preferences.remove({ key: KEY }); // dọn legacy nếu còn
    await this.save();
  },

  async refreshToken() {
    if (!this.refresh) throw new Error('no refresh token');
    const r = await withTimeout(fetch(`${this.url}/api/auth/refresh`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.refresh })
    }), LOGIN_TIMEOUT_MS);
    if (!r.ok) throw new Error('refresh fail');
    const d = await r.json();
    this.token = d.accessToken || d.token;
    if (d.refreshToken) this.refresh = d.refreshToken;
    await this.save();
  },

  authHeader() {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  },

  hasPermission(p) {
    if (this.role === 'manager' || this.role === 'admin') return true;
    return Array.isArray(this.permissions) && this.permissions.includes(p);
  }
};

export function __resetPinCache() { _pinRecordCache = null; }

if (typeof window !== 'undefined') window.authStore = authStore;
