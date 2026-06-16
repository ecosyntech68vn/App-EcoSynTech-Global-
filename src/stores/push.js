// Push notification — V5.0.0-rc1
// Base: polling 30s + LocalNotification fallback (V3 stable, không đổi)
// V5 add-on: FCM scaffold — kiểm tra runtime nếu plugin @capacitor/push-notifications có available
//             (CHƯA cài vào package.json — chỉ kích hoạt khi user manually install plugin + cap sync).
//             Mặc định FCM disabled, polling 30s vẫn chạy → KHÔNG break V4.1 stable.
import { LocalNotifications } from '@capacitor/local-notifications';
import { fallbackFetch } from '../api/fallback-client.js';
import { get, set } from 'idb-keyval';

const SEEN_KEY = 'push:seen_alert_ids';
const FCM_ENABLED_KEY = 'push:fcm_enabled';
const FCM_TOKEN_KEY = 'push:fcm_token';

export const pushStore = {
  pollTimer: null,
  fcmActive: false,
  fcmToken: null,

  async init() {
    try { await LocalNotifications.requestPermissions(); } catch (_) {}
    // V5 FCM scaffold — opt-in qua Settings
    try {
      const fcmEnabled = await get(FCM_ENABLED_KEY);
      if (fcmEnabled) await this.tryInitFcm();
    } catch (_) {}
    this.start();
  },

  // V5 — FCM init runtime-safe (KHÔNG import npm module, chỉ check Capacitor.Plugins runtime)
  async tryInitFcm() {
    try {
      const cap = window.Capacitor;
      const PushNotifications = cap?.Plugins?.PushNotifications;
      if (!PushNotifications) {
        console.info('[push] FCM plugin chưa cài — fallback polling 30s');
        return false;
      }
      const perm = await PushNotifications.requestPermissions();
      if (perm.receive !== 'granted') {
        console.info('[push] FCM perm denied — fallback polling');
        return false;
      }
      await PushNotifications.register();
      PushNotifications.addListener('registration', async (token) => {
        this.fcmToken = token.value;
        await set(FCM_TOKEN_KEY, token.value);
        console.info('[push] FCM token registered');
      });
      PushNotifications.addListener('pushNotificationReceived', async (notification) => {
        // FCM foreground → fallback local notification
        await this.notify({
          id: notification.data?.alertId || Date.now(),
          title: notification.title,
          message: notification.body,
          severity: notification.data?.severity || 'info',
          zoneId: notification.data?.zoneId
        });
      });
      this.fcmActive = true;
      return true;
    } catch (e) {
      console.warn('[push] FCM init fail:', e.message);
      return false;
    }
  },

  async enableFcm() {
    await set(FCM_ENABLED_KEY, true);
    return this.tryInitFcm();
  },

  async disableFcm() {
    await set(FCM_ENABLED_KEY, false);
    this.fcmActive = false;
  },

  start() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    // Polling 30s LUÔN chạy — kể cả khi FCM active (backup khi FCM mất)
    this.pollTimer = setInterval(() => this.checkNew(), 30000);
    this.checkNew();
  },

  stop() { if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; } },

  async checkNew() {
    try {
      const r = await fallbackFetch('/api/alerts?status=open');
      if (!r.ok) return;
      const d = await r.json();
      const alerts = Array.isArray(d) ? d : (d.items || d.alerts || []);
      const seen = (await get(SEEN_KEY)) || [];
      const newOnes = alerts.filter(a => !seen.includes(a.id || a._id));
      for (const a of newOnes) {
        await this.notify(a);
      }
      const ids = alerts.map(a => a.id || a._id).filter(Boolean);
      await set(SEEN_KEY, [...new Set([...seen, ...ids])].slice(-200));
    } catch (_) { /* offline ok */ }
  },

  async notify(a) {
    const sev = (a.severity || a.level || 'info').toLowerCase();
    const icon = sev === 'critical' ? '🚨' : sev === 'warning' ? '⚠' : 'ℹ';
    try {
      await LocalNotifications.schedule({
        notifications: [{
          id: Math.floor(Math.random() * 1e9),
          title: `${icon} ${a.title || a.message || 'Cảnh báo mới'}`,
          body: `Zone ${a.zoneId || a.zone || '-'} · ${a.severity || a.level || ''}`,
          schedule: { at: new Date(Date.now() + 100) },
          smallIcon: 'ic_stat_icon_config_sample',
          extra: { alertId: a.id || a._id }
        }]
      });
    } catch (e) {
      console.warn('[push] notify fail:', e.message);
    }
  }
};

if (typeof window !== 'undefined') window.pushStore = pushStore;
