// EcoSynTech Farm OS V3.1 — Entry point
import Alpine from 'alpinejs';
import { Network } from '@capacitor/network';
import { App as CapApp } from '@capacitor/app';

import { authStore } from './stores/auth.js';
import { syncQueue } from './stores/sync.js';
import { pushStore } from './stores/push.js';
import { bgsync } from './stores/bgsync.js';

import { renderLogin } from './pages/login.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderAlerts } from './pages/alerts.js';
import { renderLog } from './pages/log.js';
import { renderTasks } from './pages/tasks.js';
import { renderSettings } from './pages/settings.js';

// V1.1
import { renderControl } from './pages/control.js';
import { renderSchedule } from './pages/schedule.js';
import { renderChart } from './pages/chart.js';

// V1.2
import { renderScan } from './pages/scan.js';
import { renderWeather } from './pages/weather.js';
import { renderUpdate } from './pages/update.js';

// V1.3
import { renderReport } from './pages/report.js';
import { renderGallery } from './pages/gallery.js';
import { renderSOP } from './pages/sop.js';
import { renderPest } from './pages/pest.js';
import { renderFarms } from './pages/farms.js';
import { renderMore } from './pages/more.js';

// V3.1 — Truy xuất nguồn gốc
import { renderLots } from './pages/lots.js';
import { renderMaterials } from './pages/materials.js';

// V4.0 — Plan gating + Rule Builder
import { hasFeature, renderLockedPage } from './stores/plan.js';
import { renderRules } from './pages/rules.js';

import { showToast } from './components/toast.js';

window.Alpine = Alpine;
window.showToast = showToast;

const ROUTES = {
  dashboard: renderDashboard,
  alerts: renderAlerts,
  log: renderLog,
  tasks: renderTasks,
  settings: renderSettings,
  // V1.1
  control: renderControl,
  schedule: renderSchedule,
  chart: renderChart,
  // V1.2
  scan: renderScan,
  weather: renderWeather,
  update: renderUpdate,
  // V1.3
  report: renderReport,
  gallery: renderGallery,
  sop: renderSOP,
  pest: renderPest,
  farms: renderFarms,
  more: renderMore,
  // V3.1 — Truy xuất nguồn gốc
  lots: renderLots,
  materials: renderMaterials,
  // V4.0
  rules: renderRules
};
window.ROUTES = ROUTES;

// V4.0 — Gate màn theo gói (PRICING_PACKAGES_V1.md). WLC enforce thật; đây là UX + upsell.
const PAGE_FEATURE = {
  control: 'control',
  schedule: 'schedule',
  rules: 'rules',
  report: 'reports',
  pest: 'pest',
  lots: 'trace_basic',
  materials: 'trace_basic',
  farms: 'multi_farm'
};

window.appRoot = function () {
  return {
    authed: false,
    online: true,
    page: 'dashboard',
    pageHtml: '',
    alertBadge: 0,
    async init() {
      const ok = await authStore.restore();
      // V3.0.1 — seed default PIN (hash of "1234") on first run so login works offline.
      // Subsequent runs: user can change PIN in Settings; seed is idempotent.
      try { await authStore.seedDefaultPinIfEmpty(); } catch (_) {}
      this.authed = ok;
      const status = await Network.getStatus();
      this.online = status.connected;
      Network.addListener('networkStatusChange', (s) => {
        this.online = s.connected;
        if (s.connected) syncQueue.processQueue();
      });
      if (this.authed) {
        await this.nav('dashboard');
        if (this.online) syncQueue.processQueue();
        // V1.1 — start push polling
        try { await pushStore.init(); } catch(_) {}
        // V3.1 FIX #6 — runner check alert khi app bị kill: cần url + token trong KV
        try { await bgsync.pushConfigToRunner(); } catch(_) {}
      } else {
        await this.renderLoginPage();
      }
      setInterval(() => {
        if (this.online) syncQueue.processQueue();
        this.refreshAlertBadge();
      }, 30000);
      CapApp.addListener('resume', () => {
        if (this.online) syncQueue.processQueue();
      });
    },
    async renderLoginPage() {
      const html = await renderLogin();
      document.getElementById('app').innerHTML = '';
      const el = document.createElement('div');
      el.innerHTML = html;
      document.getElementById('app').appendChild(el);
      this._wireLogin();
    },
    _wireLogin() {
      const form = document.getElementById('login-form');
      if (!form) return;
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pin = form.pin.value.trim();
        const url = form.url.value.trim();
        const mode = form.mode ? form.mode.value : 'lan';
        const btn = form.querySelector('button[type=submit]');
        btn.disabled = true; btn.textContent = 'Đang đăng nhập...';
        try {
          await authStore.login({ pin, url, mode });
          window.location.reload();
        } catch (err) {
          showToast(err.message || 'Login fail', 'err');
          btn.disabled = false; btn.textContent = 'Đăng nhập';
        }
      });
    },
    async nav(page) {
      this.page = page;
      let html = '';
      try {
        // V4.0 — màn bị khoá theo gói → hiện upsell thay vì nội dung
        const need = PAGE_FEATURE[page];
        if (need && !hasFeature(need)) {
          this.pageHtml = renderLockedPage(need);
          return;
        }
        const fn = ROUTES[page] || renderDashboard;
        html = await fn();
      } catch (err) {
        html = `<div class="empty"><div class="ico">⚠</div><p>${err.message}</p></div>`;
      }
      this.pageHtml = html;
      this.$nextTick(() => {
        if (window[`wire_${page}`]) window[`wire_${page}`]();
      });
    },
    async refreshAlertBadge() {
      try {
        const { fallbackFetch } = await import('./api/fallback-client.js');
        const r = await fallbackFetch('/api/alerts?status=open');
        const data = await r.json();
        this.alertBadge = Array.isArray(data) ? data.length : (data.items ? data.items.length : 0);
      } catch (_) {}
    }
  };
};

Alpine.start();
