// Feature H — Weather forecast (OpenWeather, user-provided key)
import { authStore } from '../stores/auth.js';
import { get, set } from 'idb-keyval';

const CACHE = 'cache:weather';
const CACHE_TTL = 60 * 60 * 1000; // 1h

export async function renderWeather() {
  if (!authStore.weatherApiKey) {
    return `
      <div class="app-header">🌤 Thời tiết
        <button onclick="document.querySelector('[x-data]').__x.$data.nav('dashboard')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
      </div>
      <div class="empty">
        <div class="ico">🔑</div>
        <p>Chưa cấu hình API key OpenWeather.</p>
        <p style="margin-top:10px; font-size:13px;">Vào <strong>Cài đặt → Weather API Key</strong> để paste API key miễn phí từ openweathermap.org</p>
      </div>
    `;
  }

  const cached = await get(CACHE);
  let data = null;
  let fromCache = false;
  if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
    data = cached.data;
    fromCache = true;
  } else {
    try {
      const lat = 10.8231, lon = 106.6297; // default HCM, can use Geolocation
      const r = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${authStore.weatherApiKey}&units=metric&lang=vi`);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      data = await r.json();
      await set(CACHE, { data, ts: Date.now() });
    } catch (e) {
      if (cached) { data = cached.data; fromCache = true; }
      else return `<div class="empty"><div class="ico">⚠</div><p>Lỗi tải thời tiết: ${e.message}</p></div>`;
    }
  }

  // Render
  const list = (data && data.list) ? data.list.slice(0, 8) : [];
  return `
    <div class="app-header">🌤 Thời tiết
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('dashboard')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>
    <div style="padding:10px 16px; font-size:12px; color:var(--c-text-muted);">
      ${fromCache ? '⚠ Cache 1h' : '✓ Live'} · ${data && data.city ? escapeHtml(data.city.name) : 'HCM'}
    </div>
    ${list.map(it => {
      const dt = new Date(it.dt * 1000);
      const w = it.weather && it.weather[0] || {};
      return `
        <div class="card">
          <div class="row">
            <div>
              <div class="card-title">${dt.toLocaleString('vi-VN', {weekday:'short', hour:'2-digit', minute:'2-digit'})}</div>
              <div class="card-meta">${escapeHtml(w.description || '-')}</div>
            </div>
            <div style="text-align:right;">
              <div class="metric">${Math.round(it.main.temp)}°C</div>
              <div class="card-meta">💧 ${it.main.humidity}%</div>
            </div>
          </div>
          ${it.rain && it.rain['3h'] ? `<div class="card-meta" style="color:#0277BD;">🌧 Mưa ${it.rain['3h']}mm/3h</div>` : ''}
        </div>
      `;
    }).join('')}
  `;
}

function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

window.wire_weather = function() {};
