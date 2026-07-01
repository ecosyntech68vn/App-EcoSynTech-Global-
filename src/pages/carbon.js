import { carbonStore } from '../stores/carbon.js';
import { lotStore } from '../db/trace.js';

function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function fmtMoney(v) { return (v || 0).toLocaleString('vi-VN') + '₫'; }

export async function renderCarbon() {
  const lots = await lotStore.list();
  const growingLots = lots.filter(l => l.status === 'growing' && l.crop?.toLowerCase().includes('lúa'));
  const totals = await carbonStore.totalReduction();
  const projects = await carbonStore.listProjects();

  return `
    <div class="app-header">🌿 Tín chỉ carbon — Lúa AWD
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('more')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>

    <div class="card ok" style="text-align:center;background:#E8F5E9;">
      <div style="font-size:36px;">🌾</div>
      <div style="font-weight:700;font-size:20px;">${totals.totalReduction.toFixed(1)} tấn CO₂e</div>
      <div class="card-meta">Tổng giảm phát thải từ ${totals.projectCount} lô (${totals.awdCount} lô áp dụng AWD)</div>
      <div class="card-meta" style="font-size:18px;font-weight:600;color:#2E7D32;">💰 ${fmtMoney(totals.totalRevenue)}</div>
      <div class="card-meta">Giá tham khảo: 150.000₫/tCO₂e (thị trường tự nguyện VN)</div>
    </div>

    <div class="card">
      <div class="card-title">🌾 Lúa đang canh tác — kiểm tra AWD</div>
      ${growingLots.length === 0 ? '<div class="empty"><p>Chưa có lô lúa nào đang canh tác.</p></div>' : growingLots.map(l => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #eee;">
          <div>
            <strong>${escapeHtml(l.code)}</strong> · ${escapeHtml(l.crop)}<br/>
            <small style="color:var(--c-text-muted);">Zone ${escapeHtml(l.zoneId || '?')} · ${escapeHtml(l.area || '?')}</small>
          </div>
          <button class="btn small" onclick="window.calcCarbon('${l.id}')" style="font-size:11px;">Tính phát thải</button>
        </div>`).join('')}
    </div>

    <h3 style="padding:14px 16px 4px; color:var(--c-text-muted); font-size:13px; text-transform:uppercase;">Dự án carbon đã ghi nhận (${projects.length})</h3>
    ${projects.length === 0 ? '<div class="empty"><p>Chưa có dự án nào. Chọn lô lúa AWD và tính phát thải.</p></div>' : ''}
    ${projects.map(p => `
      <div class="card">
        <div class="row">
          <div class="card-title">${escapeHtml(p.lotCode)}</div>
          ${p.hasAwd ? '<span class="pill completed">AWD ✓</span>' : '<span class="pill">Chưa AWD</span>'}
        </div>
        <div class="card-meta">${escapeHtml(p.crop || '')} · ${p.areaHa} ha · ${p.growingDays} ngày</div>
        <div class="card-meta" style="display:flex;justify-content:space-between;">
          <span>Baseline: <strong>${p.baseline?.co2e_tons || 0} tCO₂e</strong></span>
          <span>AWD: <strong>${p.awd?.co2e_tons || 0} tCO₂e</strong></span>
          <span style="color:#2E7D32;">Giảm: <strong>${p.reduction_tons || 0} tCO₂e</strong></span>
        </div>
        <div class="card-meta" style="color:#2E7D32;font-weight:600;">💰 ${fmtMoney(p.revenue_vnd || 0)}</div>
        ${p.note ? `<p style="font-size:12px;margin:4px 0 0;color:var(--c-text-muted);">${escapeHtml(p.note)}</p>` : ''}
      </div>`).join('')}

    <div class="card" style="background:#FFFDE7;">
      <div class="card-title">💡 Hướng dẫn AWD</div>
      <ul style="margin:4px 0 0;padding-left:20px;font-size:12px;">
        <li><strong>AWD</strong> (Alternate Wetting & Drying) = tưới ngập → khô → ngập luân phiên</li>
        <li>Ghi nhật ký tưới đầy đủ trong lô để hệ thống tự phát hiện AWD</li>
        <li>Khoảng cách 5-15 ngày giữa các lần tưới = dấu hiệu AWD</li>
        <li>AWD giảm <strong>~50% CH₄</strong> (tăng ~30% N₂O) → giảm ròng ~40% CO₂e</li>
        <li>Quy đổi: CH₄ = 28 CO₂e, N₂O = 265 CO₂e (IPCC AR5)</li>
      </ul>
    </div>
  `;
}

window.calcCarbon = async (lotId) => {
  try {
    window.showToast?.('⏳ Đang tính toán...', '');
    const result = await carbonStore.saveProject(lotId);
    window.showToast?.('✅ Đã lưu dự án carbon', 'ok');
    document.querySelector('[x-data]').__x.$data.nav('carbon');
  } catch (err) {
    window.showToast?.('✗ ' + err.message, 'err');
  }
};

window.wire_carbon = function() {
  // just re-render
};
