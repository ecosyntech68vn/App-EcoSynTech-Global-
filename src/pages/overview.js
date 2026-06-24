import { fallbackFetch } from '../api/fallback-client.js';
import { authStore } from '../stores/auth.js';
import { get, set } from 'idb-keyval';
import { simulationStore } from '../stores/simulation.js';
import { financeStore } from '../stores/finance.js';
import { equipmentStore } from '../stores/equipment.js';
import { contractStore } from '../stores/contract.js';
import { soilStore } from '../stores/soil.js';

const SENSOR_CACHE = 'cache:sensors:latest';
const ALERT_CACHE = 'cache:alerts';

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function vnd(n) { return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0); }

function kpiBox(label, value, sub, color, icon, page) {
  return `<div class="card" style="padding:10px;cursor:pointer;flex:1;min-width:80px;" onclick="document.querySelector('[x-data]').__x.$data.nav('${page}')">
    <div style="display:flex;align-items:center;gap:6px;">
      <span style="font-size:24px;">${icon}</span>
      <div>
        <div style="font-size:10px;color:var(--c-text-muted);">${label}</div>
        <div style="font-size:16px;font-weight:800;color:${color || 'var(--c-text)'};">${value}</div>
        ${sub ? `<div style="font-size:10px;color:var(--c-text-muted);">${sub}</div>` : ''}
      </div>
    </div>
  </div>`;
}

function zoneCard(z) {
  const cls = z.temp > 36 || z.temp < 15 || (z.ph != null && (z.ph < 5 || z.ph > 8)) ? 'warn' : 'ok';
  return `<div class="card ${cls}" style="padding:12px;">
    <div class="row">
      <div style="font-weight:700;font-size:15px;">${esc(z.name || z.zoneId || '?')}</div>
      ${z.crop ? `<span style="font-size:12px;color:var(--c-text-muted);">${esc(z.crop)}</span>` : ''}
    </div>
    <div style="display:flex;gap:10px;margin-top:8px;flex-wrap:wrap;">
      ${z.temp != null ? `<span style="font-size:13px;">🌡 <strong>${z.temp}°C</strong></span>` : ''}
      ${z.humidity != null || z.hum != null ? `<span style="font-size:13px;">💧 <strong>${z.humidity || z.hum}%</strong></span>` : ''}
      ${z.ph != null ? `<span style="font-size:13px;">⚗ pH <strong>${z.ph}</strong></span>` : ''}
      ${z.ec != null ? `<span style="font-size:13px;">⚡ EC <strong>${z.ec}</strong></span>` : ''}
      ${z.soilMoisture != null ? `<span style="font-size:13px;">🌱 Ẩm <strong>${z.soilMoisture}%</strong></span>` : ''}
    </div>
  </div>`;
}

function alertCard(a) {
  const sev = (a.severity || 'info').toLowerCase();
  const cls = sev === 'critical' || sev === 'high' ? 'crit' : sev === 'warning' || sev === 'medium' ? 'warn' : 'ok';
  const icon = sev === 'critical' ? '🚨' : sev === 'warning' ? '⚠' : 'ℹ';
  return `<div class="card ${cls}" style="padding:10px;">
    <div class="row">
      <div style="font-size:13px;"><strong>${icon} ${esc(a.title || a.message || 'Alert')}</strong></div>
      <span style="font-size:11px;color:var(--c-text-muted);">${esc(a.zoneId || a.zone || '-')}</span>
    </div>
  </div>`;
}

export async function renderOverview() {
  let sensors = [];
  let alerts = [];
  let fromCache = false;
  const isSimulating = await simulationStore.isActive();

  if (isSimulating) {
    sensors = simulationStore.generatePayload().zones;
    alerts = simulationStore.generateAlerts(5);
  } else {
    try {
      const r = await fallbackFetch('/api/sensors/latest');
      if (r.ok) {
        const d = await r.json();
        sensors = Array.isArray(d) ? d : (d.zones || [d]);
        await set(SENSOR_CACHE, { data: sensors, ts: Date.now() });
      } else throw new Error('HTTP ' + r.status);
    } catch (_) {
      const c = await get(SENSOR_CACHE);
      if (c) { sensors = c.data; fromCache = true; }
    }
    try {
      const r = await fallbackFetch('/api/alerts?status=open');
      if (r.ok) {
        const d = await r.json();
        alerts = Array.isArray(d) ? d : (d.items || d.alerts || []);
        await set(ALERT_CACHE, { data: alerts, ts: Date.now() });
      }
    } catch (_) {
      const c = await get(ALERT_CACHE);
      if (c) alerts = c.data;
    }
  }

  const criticalAlerts = alerts.filter(a => (a.severity || '').toLowerCase() === 'critical');
  const warningAlerts = alerts.filter(a => (a.severity || '').toLowerCase() === 'warning');
  const avgTemp = sensors.length ? sensors.reduce((s, z) => s + (z.temp || z.temperature || 0), 0) / sensors.length : 0;
  const avgHum = sensors.length ? sensors.reduce((s, z) => s + (z.humidity || z.hum || 0), 0) / sensors.length : 0;

  let finSummary = { totalExpense: 0, totalRevenue: 0, profit: 0 };
  let equipSummary = { total: 0, active: 0, maintenance: 0, broken: 0 };
  let contractSummary = { active: 0, total: 0, totalValue: 0 };
  let soilSummary = { zoneCount: 0, total: 0, avgPh: 0 };
  try { finSummary = await financeStore.getSummary(); } catch (_) {}
  try { equipSummary = await equipmentStore.getSummary(); } catch (_) {}
  try { contractSummary = await contractStore.getSummary(); } catch (_) {}
  try { soilSummary = await soilStore.getSummary(); } catch (_) {}

  return `
    <div class="app-header">📊 Tổng quan nông trại
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('dashboard')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>
    ${isSimulating ? `<div style="background:#FFF3CD;padding:8px 16px;font-size:12px;color:#8B6914;text-align:center;">🧪 Đang chạy chế độ mô phỏng — dữ liệu không phải thực tế</div>` : ''}

    <div style="padding:8px 16px;font-size:13px;font-weight:600;color:var(--c-text-muted);">🌡 Môi trường</div>
    <div style="display:flex;gap:6px;padding:0 16px 6px;flex-wrap:wrap;">
      ${kpiBox('Nhiệt độ TB', avgTemp ? avgTemp.toFixed(1) + '°C' : '--', '', avgTemp > 34 ? '#c62828' : '#2E7D32', '🌡', 'dashboard')}
      ${kpiBox('Độ ẩm TB', avgHum ? avgHum.toFixed(0) + '%' : '--', '', avgHum < 40 ? '#c62828' : '#2E7D32', '💧', 'dashboard')}
      ${kpiBox('Cảnh báo', criticalAlerts.length + warningAlerts.length, criticalAlerts.length + ' critical', criticalAlerts.length ? '#c62828' : '#999', '🚨', 'alerts')}
      ${kpiBox('Zone đang chạy', sensors.length, 'online', '#1565C0', '📡', 'dashboard')}
    </div>

    <div style="padding:8px 16px;font-size:13px;font-weight:600;color:var(--c-text-muted);">💰 Kinh doanh</div>
    <div style="display:flex;gap:6px;padding:0 16px 6px;flex-wrap:wrap;">
      ${kpiBox('Tổng chi', vnd(finSummary.totalExpense), '', '#c62828', '💸', 'finance')}
      ${kpiBox('Tổng thu', vnd(finSummary.totalRevenue), '', '#2E7D32', '💰', 'finance')}
      ${kpiBox('Lợi nhuận', vnd(finSummary.profit), '', finSummary.profit >= 0 ? '#2E7D32' : '#c62828', '📈', 'finance')}
      ${kpiBox('Hợp đồng', contractSummary.active + '/' + contractSummary.total, 'đang hiệu lực', '#1565C0', '🤝', 'contract')}
    </div>

    <div style="padding:8px 16px;font-size:13px;font-weight:600;color:var(--c-text-muted);">🔧 Vận hành</div>
    <div style="display:flex;gap:6px;padding:0 16px 6px;flex-wrap:wrap;">
      ${kpiBox('Thiết bị', equipSummary.active + '/' + equipSummary.total, 'đang chạy', '#2E7D32', '🔧', 'equipment')}
      ${kpiBox('Bảo trì', equipSummary.maintenance, 'cần xử lý', '#F57F17', '🔧', 'equipment')}
      ${kpiBox('Hỏng', equipSummary.broken, '', equipSummary.broken ? '#c62828' : '#999', '🚫', 'equipment')}
      ${kpiBox('Mẫu đất', soilSummary.total, soilSummary.zoneCount + ' zone', '#5D4037', '🌱', 'soil')}
    </div>

    <h3 style="padding:8px 16px 2px;font-size:13px;color:var(--c-text-muted);text-transform:uppercase;">Cảnh báo khẩn cấp</h3>
    ${criticalAlerts.length === 0 && warningAlerts.length === 0
      ? `<div class="card ok" style="padding:10px;"><div style="font-size:13px;color:#2E7D32;">✅ Không có cảnh báo — trạng thái tốt</div></div>`
      : [...criticalAlerts, ...warningAlerts].slice(0, 5).map(alertCard).join('')}

    <h3 style="padding:8px 16px 2px;margin-top:4px;font-size:13px;color:var(--c-text-muted);text-transform:uppercase;">Cảm biến theo Zone</h3>
    ${sensors.length === 0
      ? `<div class="empty" style="padding:20px;"><div class="ico">📡</div><p>Chưa có dữ liệu cảm biến.</p></div>`
      : sensors.slice(0, 6).map(zoneCard).join('')}

    <div style="display:flex;gap:6px;padding:8px 16px 16px;flex-wrap:wrap;">
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('dashboard')" class="btn secondary" style="flex:1;padding:10px;font-size:12px;">📊 Sensor</button>
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('alerts')" class="btn secondary" style="flex:1;padding:10px;font-size:12px;">🚨 Alert</button>
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('finance')" class="btn secondary" style="flex:1;padding:10px;font-size:12px;">💰 Tài chính</button>
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('labor')" class="btn secondary" style="flex:1;padding:10px;font-size:12px;">👷 Nhân công</button>
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('contract')" class="btn secondary" style="flex:1;padding:10px;font-size:12px;">🤝 Hợp đồng</button>
    </div>

    <div style="text-align:center;padding:4px 16px 16px;font-size:11px;color:var(--c-text-muted);">
      ${fromCache ? '⚠ Dữ liệu cache' : '✓ Trực tiếp'} · ${esc(authStore.farmerId || 'local')} · ${esc(authStore.mode || 'local')}
    </div>
  `;
}

window.wire_overview = function () {};
