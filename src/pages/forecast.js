import { forecastStore } from '../stores/forecast.js';
import { t } from '../stores/i18n.js';

function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function fmtMoney(v) { return (v || 0).toLocaleString('vi-VN') + '₫'; }

export async function renderForecast() {
  const data = await forecastStore.getDashboardForecast();
  const r = data.revenue;
  const y = data.yield;

  const revBars = r.byMonth.map(([m, v]) => `
    <div style="display:flex;align-items:center;gap:8px;margin:4px 0;">
      <span style="width:60px;font-size:11px;color:var(--c-text-muted);">${m}</span>
      <div style="flex:1;background:var(--c-border);border-radius:4px;height:20px;">
        <div style="background:var(--c-primary);height:20px;border-radius:4px;width:${Math.min(100, (v / Math.max(...r.byMonth.map(x => x[1])) * 100))}%;"></div>
      </div>
      <span style="width:100px;text-align:right;font-size:11px;font-weight:600;">${fmtMoney(v)}</span>
    </div>`).join('');

  const cropBars = y.byCrop.map(([crop, qty]) => `
    <div style="display:flex;align-items:center;gap:8px;margin:4px 0;">
      <span style="width:80px;font-size:11px;color:var(--c-text-muted);">${escapeHtml(crop)}</span>
      <div style="flex:1;background:var(--c-border);border-radius:4px;height:20px;">
        <div style="background:var(--c-accent);height:20px;border-radius:4px;width:${Math.min(100, (qty / Math.max(...y.byCrop.map(x => x[1])) * 100))}%;"></div>
      </div>
      <span style="width:80px;text-align:right;font-size:11px;font-weight:600;">${qty.toFixed(1)} kg</span>
    </div>`).join('');

  return `
    <div class="app-header">📈 Dự báo & Phân tích
      <button onclick="document.querySelector('[x-data]').__x.\$data.nav('more')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:8px 16px;">
      <div class="card" style="margin:0;text-align:center;padding:10px;">
        <div style="font-size:22px;font-weight:700;color:var(--c-ok);">${fmtMoney(r.monthlyAvg)}</div>
        <div class="card-meta">${t('revenue')}/tháng (TB)</div>
      </div>
      <div class="card" style="margin:0;text-align:center;padding:10px;">
        <div style="font-size:22px;font-weight:700;">${y.totalHarvested.toFixed(1)} kg</div>
        <div class="card-meta">${t('yield_field')} (đã thu)</div>
      </div>
      <div class="card" style="margin:0;text-align:center;padding:10px;">
        <div style="font-size:22px;font-weight:700;color:${r.trend >= 0 ? 'var(--c-ok)' : 'var(--c-crit)'};">${r.trend >= 0 ? '+' : ''}${r.trend}%</div>
        <div class="card-meta">${t('revenue')} trend</div>
      </div>
      <div class="card" style="margin:0;text-align:center;padding:10px;">
        <div style="font-size:22px;font-weight:700;color:var(--c-accent);">${y.estimatedFuture.toFixed(1)} kg</div>
        <div class="card-meta">Dự kiến (${y.activeLots} lô)</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">💰 Dự báo doanh thu</div>
      <div class="card-meta">Doanh thu TB/ngày: <strong>${fmtMoney(r.dailyAvg)}</strong> · Dự báo 90 ngày: <strong>${fmtMoney(r.projectedRevenue)}</strong></div>
      <div class="card-meta">Độ tin cậy: <strong style="color:${r.confidence === 'high' ? 'var(--c-ok)' : r.confidence === 'medium' ? 'var(--c-warn)' : 'var(--c-crit)'};">${r.confidence === 'high' ? 'Cao' : r.confidence === 'medium' ? 'Trung bình' : 'Thấp'}</strong> (${r.totalOrders} đơn)</div>
      <div style="margin-top:8px;">${revBars}</div>
    </div>

    <div class="card">
      <div class="card-title">🌾 Dự báo sản lượng theo cây trồng</div>
      <div class="card-meta">Trung bình ${y.avgPerLot.toFixed(1)} kg/lô · ${y.activeLots} lô đang canh tác</div>
      <div style="margin-top:8px;">${cropBars}</div>
    </div>

    <div class="card" style="text-align:center;border:1px dashed var(--c-border);">
      <div class="card-title">🧠 Phân tích thông minh</div>
      <div class="card-meta">
        Dự báo được cập nhật dựa trên dữ liệu bán hàng và sản lượng thực tế.<br/>
        Khi có đủ dữ liệu (≥10 đơn, ≥5 lô), AI sẽ đưa ra khuyến nghị cụ thể.<br/>
        <span style="font-size:11px;color:var(--c-text-muted);">Cập nhật lần cuối: ${new Date(data.generatedAt).toLocaleString('vi-VN')}</span>
      </div>
      <button class="btn secondary" style="margin-top:8px;" onclick="document.querySelector('[x-data]').__x.\$data.nav('forecast')">🔄 Làm mới</button>
    </div>
  `;
}
