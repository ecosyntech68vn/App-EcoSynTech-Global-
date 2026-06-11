// Push notification — polling 30s background + Local Notification fallback
import { LocalNotifications } from '@capacitor/local-notifications';
import { fallbackFetch } from '../api/fallback-client.js';
import { get, set } from 'idb-keyval';

const SEEN_KEY = 'push:seen_alert_ids';

export const pushStore = {
  pollTimer: null,

  async init() {
    try { await LocalNotifications.requestPermissions(); } catch (_) {}
    this.start();
  },

  start() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => this.checkNew(), 30000);
    // Run once immediately
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
      // Update seen list (keep last 200)
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
