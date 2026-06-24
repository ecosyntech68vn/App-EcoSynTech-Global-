import { consolidatedStore } from '../stores/consolidated.js';
import { authStore } from '../stores/auth.js';

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function vnd(n) { return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0); }

function kpiBig(label, value, color, sub, page) {
  return `<div class="card" style="padding:12px;cursor:pointer;flex:1;min-width:100px;" onclick="${page ? `document.querySelector('[x-data]').__x.$data.nav('${page}')` : ''}">
    <div style="font-size:11px;color:var(--c-text-muted);text-transform:uppercase;">${label}</div>
    <div style="font-size:22px;font-weight:800;color:${color || 'var(--c-text)'};">${value}</div>
    ${sub ? `<div style="font-size:10px;color:var(--c-text-muted);margin-top:2px;">${sub}</div>` : ''}
  </div>`;
}

export async function renderConsolidated() {
  const kpi = await consolidatedStore.getMasterKPI();
  const summaryDate = new Date(kpi.timestamp).toLocaleString('vi-VN');

  return `
    <div class="app-header">📊 Báo cáo tổng hợp
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('more')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>

    <div style="background:#E8F5E9;padding:2px 16px;font-size:11px;color:#2E7D32;text-align:center;">
      Cập nhật: ${summaryDate} · ${esc(authStore.farmerId || 'local')}
    </div>

    <div style="padding:10px 16px;font-size:14px;font-weight:700;color:var(--c-text);">💰 Tài chính</div>
    <div style="display:flex;gap:6px;padding:0 16px 6px;flex-wrap:wrap;">
      ${kpiBig('Tổng thu', vnd(kpi.finance.totalRevenue), '#2E7D32', '', 'finance')}
      ${kpiBig('Tổng chi', vnd(kpi.finance.totalExpense), '#c62828', '', 'finance')}
      ${kpiBig('Lợi nhuận', vnd(kpi.finance.grossProfit), kpi.finance.grossProfit >= 0 ? '#2E7D32' : '#c62828', 'Margin: ' + kpi.finance.margin + '%', 'finance')}
    </div>

    <div style="padding:0 16px;font-size:14px;font-weight:700;color:var(--c-text);">🏢 Tổng tài sản</div>
    <div style="display:flex;gap:6px;padding:8px 16px 6px;flex-wrap:wrap;">
      ${kpiBig('Thiết bị', kpi.assets.equipment.active + '/' + kpi.assets.equipment.total + ' cái', '#1565C0', 'G.trị: ' + vnd(kpi.assets.equipment.estimatedValue), 'equipment')}
      ${kpiBig('Hợp đồng', kpi.contracts.active + '/' + kpi.contracts.total, '#6A1B9A', 'G.trị: ' + vnd(kpi.assets.contractValue), 'contract')}
      ${kpiBig('Tồn kho', vnd(kpi.inventory.totalMaterialValue), '#E65100', kpi.inventory.activeLots + ' lô đang hoạt động', 'inventory')}
      ${kpiBig('Tồn lô', kpi.inventory.harvestedLots + ' đã thu hoạch', '#2E7D32', kpi.inventory.totalLots + ' tổng', 'lots')}
    </div>

    <div style="padding:0 16px;font-size:14px;font-weight:700;color:var(--c-text);">🔧 Vận hành & An toàn</div>
    <div style="display:flex;gap:6px;padding:8px 16px 6px;flex-wrap:wrap;">
      ${kpiBig('Thiết bị hư', kpi.equipment.broken, kpi.equipment.broken ? '#c62828' : '#999', kpi.equipment.maintenance + ' đang bảo trì', 'equipment')}
      ${kpiBig('Thu hồi', kpi.recalls.urgent, kpi.recalls.urgent ? '#c62828' : '#999', kpi.recalls.open + ' chờ XL / ' + kpi.recalls.resolved + ' đã xong', 'recall')}
      ${kpiBig('Kiểm định', kpi.inspections.passRate + '% đạt', kpi.inspections.passRate >= 80 ? '#2E7D32' : '#c62828', kpi.inspections.fail + ' không đạt', 'trace-advanced')}
      ${kpiBig('Mẫu đất', kpi.soils.total, '#5D4037', kpi.soils.zoneCount + ' zone', 'soil')}
    </div>

    <div style="padding:10px 16px;font-size:14px;font-weight:700;color:var(--c-text);">📈 Chi phí theo danh mục</div>
    <div style="padding:0 16px 16px;">
      ${kpi.finance.totalExpense > 0 && kpi.finance.breakdown?.expenses
        ? `<div class="card" style="padding:12px;">
            ${Object.entries(kpi.finance.breakdown.expenses)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, val]) => {
                const pct = Math.round(val / kpi.finance.totalExpense * 100);
                return `<div style="margin:4px 0;">
                  <div class="row">
                    <span style="font-size:13px;">${esc(cat)}</span>
                    <span style="font-size:13px;font-weight:600;">${vnd(val)} (${pct}%)</span>
                  </div>
                  <div style="height:6px;background:#e0e0e0;border-radius:3px;overflow:hidden;">
                    <div style="height:100%;width:${pct}%;background:#c62828;border-radius:3px;"></div>
                  </div>
                </div>`;
              }).join('')}
            <div style="margin-top:8px;font-size:12px;color:var(--c-text-muted);">
              Nhân công: ${vnd(kpi.finance.laborCost)} · Vật tư: ${vnd(kpi.finance.materialCost)} · Chế biến: ${vnd(kpi.finance.processingCost)}
            </div>
          </div>`
        : '<div class="card-meta" style="padding:8px 0;">Chưa có dữ liệu chi phí.</div>'
      }
    </div>

    <div style="display:flex;gap:4px;padding:8px 16px 16px;flex-wrap:wrap;">
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('finance')" class="btn secondary" style="font-size:12px;">💰 Tài chính</button>
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('equipment')" class="btn secondary" style="font-size:12px;">🔧 Thiết bị</button>
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('contract')" class="btn secondary" style="font-size:12px;">🤝 Hợp đồng</button>
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('recall')" class="btn secondary" style="font-size:12px;">🚨 Thu hồi</button>
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('trace-advanced')" class="btn secondary" style="font-size:12px;">🔍 Truy xuất</button>
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('lots')" class="btn secondary" style="font-size:12px;">🌾 Lô</button>
    </div>
  `;
}

window.wire_consolidated = function () {};
