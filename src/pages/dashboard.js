// Sensor Dashboard — polling /api/sensors/latest
import { fallbackFetch } from '../api/fallback-client.js';
import { get, set } from 'idb-keyval';

const CACHE_KEY = 'cache:sensors:latest';
let pollTimer = null;

export async function renderDashboard() {
  // Try fresh fetch, fallback to cache
  let data = null;
  let fromCache = false;
  let updatedAt = null;
  try {
    const r = await fallbackFetch('/api/sensors/latest');
    if (r.ok) {
      data = await r.json();
      await set(CACHE_KEY, { data, ts: Date.now() });
      updatedAt = new Date();
    } else throw new Error('HTTP ' + r.status);
  } catch (e) {
    const cached = await get(CACHE_KEY);
    if (cached) { data = cached.data; fromCache = true; updatedAt = new Date(cached.ts); }
  }

  const zones = normalize(data);

  // Setup polling (5s) when page active
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (document.hidden) return;
    try {
      const r = await fallbackFetch('/api/sensors/latest');
      if (r.ok) {
        const d = await r.json();
        await set(CACHE_KEY, { data: d, ts: Date.now() });
        rerenderCards(normalize(d));
      }
    } catch (_) { /* keep cache */ }
  }, 5000);

  return `
    <div class="app-header">📊 Sensor Dashboard</div>
    <div style="padding:10px 16px; font-size:12px; color:var(--c-text-muted);">
      ${fromCache ? '⚠ Cached' : '✓ Live'} · cập nhật ${updatedAt ? timeAgo(updatedAt) : '-'}
      <button id="refresh-dash" style="float:right; border:0; background:none; color:var(--c-primary); font-weight:600;">↻ Refresh</button>
    </div>
    <div id="sensor-cards">${renderCards(zones)}</div>
  `;
}

function normalize(data) {
  if (!data) return [];
  // WLC sensors/latest can return: array of zone objects, or {zones:[]}, or single object
  if (Array.isArray(data)) return data.map(mapZone);
  if (data.zones && Array.isArray(data.zones)) return data.zones.map(mapZone);
  // Fallback: assume flat
  return [mapZone(data)];
}

function mapZone(z) {
  return {
    id: z.zoneId || z.id || z.zone || 'Z?',
    name: z.name || z.zoneName || ('Zone ' + (z.zoneId || z.id || '')),
    temp: pick(z, ['temp','temperature','t']),
    hum:  pick(z, ['hum','humidity','h']),
    ph:   pick(z, ['ph','pH']),
    ec:   pick(z, ['ec','EC']),
    water: pick(z, ['water','waterLevel','wl']),
    status: pick(z, ['status','state']) || 'ok'
  };
}
function pick(o, keys) {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
  return null;
}

function renderCards(zones) {
  if (!zones || zones.length === 0) {
    return `<div class="empty"><div class="ico">📡</div><p>Chưa có data sensor.</p></div>`;
  }
  return zones.map(z => {
    const cls = classify(z);
    return `
      <div class="card ${cls}">
        <div class="row">
          <div class="card-title">${escapeHtml(z.name)}</div>
          <span class="card-meta">${escapeHtml(z.id)}</span>
        </div>
        <div class="row" style="margin-top:10px; gap:14px; flex-wrap:wrap;">
          ${cell('🌡 Temp', z.temp, '°C')}
          ${cell('💧 Hum', z.hum, '%')}
          ${cell('⚗ pH', z.ph, '')}
          ${cell('⚡ EC', z.ec, 'mS')}
          ${cell('🌊 Water', z.water, '')}
        </div>
      </div>
    `;
  }).join('');
}
function cell(label, v, unit) {
  if (v === null || v === undefined) return '';
  return `<div><div class="metric-label">${label}</div><div class="metric">${v}${unit}</div></div>`;
}
function classify(z) {
  // Simple threshold — production should use rules from server
  if (z.temp != null && (z.temp > 38 || z.temp < 10)) return 'crit';
  if (z.ph != null && (z.ph < 5.0 || z.ph > 8.5)) return 'crit';
  if (z.temp != null && (z.temp > 34 || z.temp < 14)) return 'warn';
  return 'ok';
}
function rerenderCards(zones) {
  const el = document.getElementById('sensor-cards');
  if (el) el.innerHTML = renderCards(zones);
}
function timeAgo(d) {
  const s = Math.floor((Date.now() - d.getTime())/1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  return Math.floor(s/3600) + 'h ago';
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

window.wire_dashboard = function() {
  document.getElementById('refresh-dash')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('reload-dashboard'));
    // Simple: trigger re-render
    document.querySelector('[x-data]')?.__x?.$data?.nav?.('dashboard');
  });
};
