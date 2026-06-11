// Feature J — Background sync wrapper (Workmanager via Capacitor Background-runner)
// V3.1 FIX #6: đẩy config (url + token) xuống runner KV để runner tự check alert
// mỗi 15 phút kể cả khi app bị kill. Token local-only sẽ bị runner bỏ qua.
import { BackgroundRunner } from '@capacitor/background-runner';
import { syncQueue } from './sync.js';
import { authStore } from './auth.js';

export const bgsync = {
  intervalId: null,

  // Foreground fallback: 15 min interval
  startForegroundLoop() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => syncQueue.processQueue(), 15 * 60 * 1000);
  },

  stop() { if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; } },

  // FIX #6 — gọi sau login() và sau khi đổi Settings: runner cần url + token để poll alert
  async pushConfigToRunner() {
    try {
      await BackgroundRunner.dispatchEvent({
        label: 'vn.ecosyntech.farmos.sync',
        event: 'saveConfig',
        details: { url: authStore.url || '', token: authStore.token || '' }
      });
      console.log('[bgsync] runner config updated');
    } catch (e) {
      // Browser dev / plugin chưa sẵn sàng — bỏ qua
      console.warn('[bgsync] pushConfigToRunner skip:', e.message);
    }
  },

  // Dispatch to native background event (when registered in capacitor.config)
  async dispatchSync() {
    try {
      await BackgroundRunner.dispatchEvent({
        label: 'vn.ecosyntech.farmos.sync',
        event: 'sync',
        details: { ts: Date.now() }
      });
    } catch (e) {
      // Fallback to FG
      await syncQueue.processQueue();
    }
  }
};

if (typeof window !== 'undefined') window.bgsync = bgsync;
