// Feature E — Sensor history chart (24h / 7d / 30d) with Chart.js
import { fallbackFetch } from '../api/fallback-client.js';
import { get, set } from 'idb-keyval';
import Chart from 'chart.js/auto';
import { esc } from '../lib/escape.js';

const CACHE = 'cache:chart';

let chartInstance = null;

export async function renderChart() {
  return `
    <div class="app-header">📈 Biểu đồ lịch sử
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('dashboard')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>

    <div class="form" style="padding:10px 16px 0;">
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <select id="chart-metric" style="flex:1; min-width:120px;">
          <option value="temp">🌡 Temperature</option>
          <option value="humidity">💧 Humidity</option>
          <option value="ph">⚗ pH</option>
          <option value="ec">⚡ EC</option>
          <option value="soil_moisture">🌊 Soil Moisture</option>
        </select>
        <select id="chart-range">
          <option value="24h">24 giờ</option>
          <option value="7d">7 ngày</option>
          <option value="30d">30 ngày</option>
        </select>
        <button id="chart-load" class="btn secondary" style="width:auto; padding:8px 14px;">Tải</button>
      </div>
    </div>

    <div style="padding:16px;">
      <div style="background:#fff; border-radius:12px; padding:16px; box-shadow:var(--c-shadow); position:relative; height:380px;">
        <canvas id="sensor-chart"></canvas>
      </div>
      <div id="chart-stats" style="margin-top:12px;"></div>
    </div>
  `;
}

window.wire_chart = function() {
  document.getElementById('chart-load')?.addEventListener('click', loadChart);
  // Auto-load default
  loadChart();
};

async function loadChart() {
  const metric = document.getElementById('chart-metric').value;
  const range = document.getElementById('chart-range').value;
  const limit = range === '24h' ? 144 : range === '7d' ? 168 : 720; // 10min / hourly / hourly

  let points = [];
  let fromCache = false;
  try {
    const r = await fallbackFetch(`/api/sensors/history/${metric}?limit=${limit}`);
    if (r.ok) {
      const d = await r.json();
      points = Array.isArray(d) ? d : (d.items || d.data || []);
      await set(`${CACHE}:${metric}:${range}`, { data: points, ts: Date.now() });
    } else throw new Error('HTTP ' + r.status);
  } catch (_) {
    const c = await get(`${CACHE}:${metric}:${range}`);
    if (c) { points = c.data; fromCache = true; }
  }

  renderChartJs(points, metric, range, fromCache);
}

function renderChartJs(points, metric, range, fromCache) {
  const ctx = document.getElementById('sensor-chart');
  if (!ctx) return;
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

  const labels = points.map(p => {
    const t = p.ts || p.timestamp || p.time || p.created_at;
    const d = new Date(t);
    return range === '24h' ? d.getHours() + 'h' : d.toLocaleDateString('vi-VN');
  });
  const data = points.map(p => p.value ?? p.val ?? p[metric] ?? null);
  const colors = { temp:'#C62828', humidity:'#0277BD', ph:'#7B1FA2', ec:'#F57C00', soil_moisture:'#388E3C' };

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: `${metric} (${range})${fromCache ? ' · cached' : ''}`,
        data,
        borderColor: colors[metric] || '#2E7D32',
        backgroundColor: (colors[metric] || '#2E7D32') + '20',
        tension: 0.3,
        fill: true,
        pointRadius: range === '24h' ? 0 : 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'top' } },
      scales: { y: { beginAtZero: false } }
    }
  });

  // Stats
  if (data.length > 0) {
    const valid = data.filter(v => v != null);
    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const avg = (valid.reduce((s, v) => s + v, 0) / valid.length).toFixed(2);
    document.getElementById('chart-stats').innerHTML = `
      <div class="card" style="margin:0;">
        <div class="row">
          <div><div class="metric-label">Min</div><div class="metric">${esc(min)}</div></div>
          <div><div class="metric-label">Avg</div><div class="metric">${esc(avg)}</div></div>
          <div><div class="metric-label">Max</div><div class="metric">${esc(max)}</div></div>
          <div><div class="metric-label">Points</div><div class="metric">${esc(valid.length)}</div></div>
        </div>
      </div>`;
  } else {
    document.getElementById('chart-stats').innerHTML = `
      <div class="empty"><p>Không có dữ liệu lịch sử.</p></div>`;
  }
}
