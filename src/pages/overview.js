import { fallbackFetch } from '../api/fallback-client.js';
import { authStore } from '../stores/auth.js';
import { get, set } from 'idb-keyval';
import { simulationStore } from '../stores/simulation.js';

const SENSOR_CACHE = 'cache:sensors:latest';
const ALERT_CACHE = 'cache:alerts';

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function statBlock(label, value, unit, color) {
  return `<div style="flex:1;background:#fff;border:1px solid var(--c-border);border-radius:10px;padding:10px 6px;text-align:center;">
    <div style="font-size:20px;font-weight:800;color:${color || 'var(--c-text)'};">${value}</div>
    <div style="font-size:10px;color:var(--c-text-muted);">${label}</div>
    ${unit ? `<div style="font-size:11px;color:var(--c-text-muted);">${unit}</div>` : ''}
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

  const criticalAlerts = alerts.filter(a => (a.severity || '').toLowerCase() === 'critical' || (a.level || '').toLowerCase() === 'high');
  const warningAlerts = alerts.filter(a => (a.severity || '').toLowerCase() === 'warning' || (a.level || '').toLowerCase() === 'medium');
  const avgTemp = sensors.length ? sensors.reduce((s, z) => s + (z.temp || z.temperature || 0), 0) / sensors.length : 0;
  const avgHum = sensors.length ? sensors.reduce((s, z) => s + (z.humidity || z.hum || 0), 0) / sensors.length : 0;

  return `
    <div class="app-header">📊 Tổng quan nông trại
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('dashboard')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>
    ${isSimulating ? `<div style="background:#FFF3CD;padding:8px 16px;font-size:12px;color:#8B6914;text-align:center;">🧪 Đang chạy chế độ mô phỏng — dữ liệu không phải thực tế</div>` : ''}
    <div style="display:flex;gap:6px;padding:10px 16px;">
      ${statBlock('🌡 Nhiệt độ TB', avgTemp ? avgTemp.toFixed(1) : '--', '°C', avgTemp > 34 ? '#c62828' : '#2E7D32')}
      ${statBlock('💧 Độ ẩm TB', avgHum ? avgHum.toFixed(0) : '--', '%', avgHum < 40 ? '#c62828' : '#2E7D32')}
      ${statBlock('📡 Zone', sensors.length, 'online', '#1565C0')}
      ${statBlock('🚨 Cảnh báo', criticalAlerts.length + warningAlerts.length, `${criticalAlerts.length} critical`, criticalAlerts.length ? '#c62828' : '#999')}
    </div>

    <h3 style="padding:8px 16px 2px;font-size:13px;color:var(--c-text-muted);text-transform:uppercase;">Cảnh báo khẩn cấp</h3>
    ${criticalAlerts.length === 0 && warningAlerts.length === 0
      ? `<div class="card ok" style="padding:10px;"><div style="font-size:13px;color:#2E7D32;">✅ Không có cảnh báo — trạng thái tốt</div></div>`
      : [...criticalAlerts, ...warningAlerts].slice(0, 5).map(alertCard).join('')}

    <h3 style="padding:8px 16px 2px;margin-top:4px;font-size:13px;color:var(--c-text-muted);text-transform:uppercase;">Cảm biến theo Zone</h3>
    ${sensors.length === 0
      ? `<div class="empty" style="padding:20px;"><div class="ico">📡</div><p>Chưa có dữ liệu cảm biến.</p></div>`
      : sensors.slice(0, 8).map(zoneCard).join('')}

    <div style="display:flex;gap:8px;padding:8px 16px 16px;">
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('dashboard')" class="btn secondary" style="flex:1;padding:10px;font-size:13px;">📊 Sensor chi tiết</button>
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('alerts')" class="btn secondary" style="flex:1;padding:10px;font-size:13px;">🚨 Tất cả cảnh báo</button>
    </div>

    <div style="text-align:center;padding:4px 16px 16px;font-size:11px;color:var(--c-text-muted);">
      ${fromCache ? '⚠ Dữ liệu cache' : '✓ Trực tiếp'} · ${esc(authStore.farmerId || 'local')} · ${esc(authStore.mode || 'local')}
    </div>
  `;
}

window.wire_overview = function () {};
