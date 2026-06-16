// inventory.js — V5.1 Quản trị kho (EOP Inventory module).
// Lõi tổng quát: Vật tư (raw) + Thành phẩm (finished, tự nhập từ thu hoạch) + Lịch sử nhập/xuất (append-only).
import { materialsStore, inventoryStore } from '../db/trace.js';

const TYPE_LBL = { fertilizer: '🧪 Phân bón', pesticide: '☠️ Thuốc BVTV', other: '📦 Khác' };
const MOVE_LBL = { import: '⬇ Nhập', export: '⬆ Xuất', transfer: '↔ Chuyển', count: '📋 Kiểm kê' };

function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function stat(label, val, color) {
  return `<div style="flex:1; background:#fff; border:1px solid var(--c-border,#e3e3e3); border-radius:10px; padding:12px 8px; text-align:center;">
    <div style="font-size:22px; font-weight:700; color:${color || 'var(--c-text)'};">${val}</div>
    <div style="font-size:11px; color:var(--c-text-muted); margin-top:2px;">${label}</div>
  </div>`;
}

export async function renderInventory() {
  const mats = await materialsStore.list();
  const finished = await inventoryStore.finishedList();
  const moves = await inventoryStore.movements();
  const lowMats = mats.filter(m => m.stock && m.stock.lowAt > 0 && m.stock.qty <= m.stock.lowAt);
  const inStock = finished.filter(f => f.qty > 0);

  return `
    <div class="app-header">🏬 Kho — Vật tư & Thành phẩm
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('more')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>

    <div style="display:flex; gap:8px; padding:12px 16px;">
      ${stat('Mã thành phẩm', inStock.length, '#2E7D32')}
      ${stat('Loại vật tư', mats.length, '#1565C0')}
      ${stat('Sắp hết', lowMats.length, lowMats.length ? '#c62828' : '#999')}
    </div>

    <!-- ===== Thành phẩm ===== -->
    <h3 style="padding:6px 16px 4px; color:var(--c-text-muted); font-size:13px; text-transform:uppercase;">Thành phẩm trong kho (${inStock.length})</h3>
    ${finished.length === 0
      ? `<div class="empty" style="padding:16px;"><p>Chưa có thành phẩm. Thu hoạch một lô → sản lượng tự vào kho tại đây.</p></div>`
      : finished.map(f => {
          const std = (f.trace && f.trace.standards || []).map(s => `<span class="pill completed" style="margin-right:3px;">${escapeHtml(s)}</span>`).join('');
          return `
          <div class="card ${f.qty > 0 ? 'ok' : ''}">
            <div class="row">
              <div class="card-title" style="font-size:15px;">${escapeHtml(f.name)}</div>
              <span class="pill ${f.qty > 0 ? 'completed' : 'pending-sync'}"><strong>${f.qty}</strong> ${escapeHtml(f.unit)}</span>
            </div>
            <div class="card-meta">Lô: <strong>${escapeHtml(f.lotCode)}</strong>${f.harvestDate ? ' · TH ' + escapeHtml(f.harvestDate) : ''}${f.trace && f.trace.puc ? ' · PUC ' + escapeHtml(f.trace.puc) : ''}</div>
            ${std ? `<div style="margin-top:4px;">${std}</div>` : ''}
            <div style="display:flex; gap:6px; margin-top:8px; flex-wrap:wrap;">
              <button data-fg-in="${escapeHtml(f.id)}" class="btn secondary" style="padding:6px 12px; font-size:13px;">⬇ Nhập</button>
              ${f.qty > 0 ? `<button data-fg-issue="${escapeHtml(f.id)}" class="btn secondary" style="padding:6px 12px; font-size:13px;">⬆ Xuất bán</button>` : ''}
              ${f.qty > 0 ? `<button data-fg-xfer="${escapeHtml(f.id)}" class="btn secondary" style="padding:6px 12px; font-size:13px;">↔ Chuyển CN</button>` : ''}
            </div>
          </div>`;
        }).join('')}

    <!-- ===== Vật tư ===== -->
    <h3 style="padding:14px 16px 4px; color:var(--c-text-muted); font-size:13px; text-transform:uppercase;">Vật tư tồn kho (${mats.length})
      <span style="float:right; text-transform:none;"><a onclick="document.querySelector('[x-data]').__x.$data.nav('materials')" style="color:var(--c-primary,#1565C0); cursor:pointer; font-size:12px;">Quản lý chi tiết →</a></span>
    </h3>
    ${mats.map(m => {
      const st = m.stock || { qty: 0, unit: '', lowAt: 0 };
      const isLow = st.lowAt > 0 && st.qty <= st.lowAt;
      return `
      <div class="card ${isLow ? 'warn' : ''}">
        <div class="row">
          <div class="card-title" style="font-size:14px;">${escapeHtml(m.name)}</div>
          <div class="card-meta">Tồn: <strong style="color:${isLow ? '#c62828' : 'inherit'};">${st.qty}${st.unit ? ' ' + escapeHtml(st.unit) : ''}</strong>${isLow ? ' ⚠' : ''}</div>
        </div>
        <div class="row" style="margin-top:6px; align-items:center;">
          <div class="card-meta">${TYPE_LBL[m.type] || m.type}${m.phiDays > 0 ? ' · PHI ' + m.phiDays + 'd' : ''}</div>
          <div style="display:flex; gap:5px;" data-mid="${escapeHtml(m.id)}" data-name="${escapeHtml(m.name)}" data-unit="${escapeHtml(st.unit || '')}">
            <button class="mat-in" style="padding:3px 10px; border:1px solid var(--c-border); border-radius:6px; background:none; font-size:12px;">⬇ Nhập</button>
            <button class="mat-out" style="padding:3px 10px; border:1px solid var(--c-border); border-radius:6px; background:none; font-size:12px;">⬆ Xuất</button>
            <button class="mat-xfer" style="padding:3px 10px; border:1px solid var(--c-border); border-radius:6px; background:none; font-size:12px;">↔ Chuyển</button>
          </div>
        </div>
      </div>`;
    }).join('')}

    <!-- ===== Lịch sử nhập/xuất ===== -->
    <h3 style="padding:14px 16px 4px; color:var(--c-text-muted); font-size:13px; text-transform:uppercase;">Lịch sử nhập / xuất (${moves.length})</h3>
    ${moves.length === 0 ? `<div class="empty" style="padding:16px;"><p>Chưa có chuyển động kho.</p></div>` : ''}
    ${moves.slice(0, 40).map(mv => `
      <div class="card">
        <div class="row">
          <div class="card-title" style="font-size:14px;">${MOVE_LBL[mv.type] || mv.type} · ${escapeHtml(mv.itemName || '')}</div>
          <span class="card-meta">${escapeHtml(new Date(mv.ts).toLocaleString('vi-VN'))}</span>
        </div>
        <div class="card-meta">${mv.kind === 'finished' ? 'Thành phẩm' : 'Vật tư'} · <strong>${mv.qty}</strong> ${escapeHtml(mv.unit || '')}${mv.ref ? ' · ' + escapeHtml(mv.ref) : ''}${mv.note ? ' · ' + escapeHtml(mv.note) : ''}</div>
      </div>`).join('')}
  `;
}

window.wire_inventory = function() {
  const nav = () => document.querySelector('[x-data]').__x.$data.nav('inventory');

  // ===== Thành phẩm: Nhập / Xuất / Chuyển =====
  document.querySelectorAll('[data-fg-in]').forEach(b => b.addEventListener('click', async () => {
    const q = prompt('Số lượng NHẬP kho:'); if (!q) return;
    await inventoryStore.importFinished(b.dataset.fgIn, q, prompt('Ghi chú (nguồn nhập):') || '');
    window.showToast?.('✓ Đã nhập kho thành phẩm', 'ok'); nav();
  }));
  document.querySelectorAll('[data-fg-issue]').forEach(b => b.addEventListener('click', async () => {
    const q = prompt('Số lượng XUẤT (bán/giao):'); if (!q) return;
    await inventoryStore.issueFinished(b.dataset.fgIssue, q, prompt('Ghi chú (khách / phiếu giao):') || '');
    window.showToast?.('✓ Đã xuất kho', 'ok'); nav();
  }));
  document.querySelectorAll('[data-fg-xfer]').forEach(b => b.addEventListener('click', async () => {
    const q = prompt('Số lượng CHUYỂN:'); if (!q) return;
    const to = prompt('Chuyển đến chi nhánh / trang trại:'); if (!to) return;
    await inventoryStore.transferFinished(b.dataset.fgXfer, q, to, '');
    window.showToast?.('✓ Đã ghi chuyển chi nhánh', 'ok'); nav();
  }));

  // ===== Vật tư: Nhập / Xuất / Chuyển (lấy id/name/unit từ div cha) =====
  const raw = (sel, fn) => document.querySelectorAll(sel).forEach(btn => btn.addEventListener('click', async () => {
    const d = btn.parentElement.dataset;
    if (await fn(d.mid, d.name, d.unit) !== false) nav();
  }));
  raw('.mat-in', async (id, name, unit) => {
    const q = prompt('Số lượng NHẬP:'); if (!q) return false;
    await materialsStore.adjustStock(id, Math.abs(parseFloat(q) || 0));
    await inventoryStore._move({ kind: 'raw', itemId: id, itemName: name, type: 'import', qty: parseFloat(q) || 0, unit, note: 'Nhập kho' });
  });
  raw('.mat-out', async (id, name, unit) => {
    const q = prompt('Số lượng XUẤT:'); if (!q) return false;
    await materialsStore.adjustStock(id, -Math.abs(parseFloat(q) || 0));
    await inventoryStore._move({ kind: 'raw', itemId: id, itemName: name, type: 'export', qty: parseFloat(q) || 0, unit, note: prompt('Lý do xuất:') || 'Xuất kho' });
  });
  raw('.mat-xfer', async (id, name, unit) => {
    const q = prompt('Số lượng CHUYỂN:'); if (!q) return false;
    const to = prompt('Chuyển đến chi nhánh / trang trại:'); if (!to) return false;
    await materialsStore.adjustStock(id, -Math.abs(parseFloat(q) || 0));
    await inventoryStore.transferRaw(id, name, q, unit, to, '');
    window.showToast?.('✓ Đã chuyển chi nhánh', 'ok');
  });
};
