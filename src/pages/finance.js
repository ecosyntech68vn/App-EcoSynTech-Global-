import { financeStore, CATEGORIES } from '../stores/finance.js';
import { authStore } from '../stores/auth.js';

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function catOptions(type) {
  const cats = CATEGORIES[type] || [];
  return cats.map(c => `<option value="${c.id}">${c.icon} ${esc(c.label)}</option>`).join('');
}

function vnd(n) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);
}

function entryRow(e) {
  const isExpense = e.type === 'expense';
  const cats = CATEGORIES[isExpense ? 'expense' : 'revenue'] || [];
  const cat = cats.find(c => c.id === e.category);
  const catIcon = cat ? cat.icon : (isExpense ? '💸' : '💰');
  const catLabel = cat ? cat.label : e.category;
  return `<div class="card" style="padding:10px;">
    <div class="row">
      <div>
        <span style="font-weight:600;">${catIcon} ${esc(catLabel)}</span>
        <span style="color:${isExpense ? '#c62828' : '#2E7D32'};font-weight:700;margin-left:8px;">${vnd(e.amount)}</span>
      </div>
      <button class="btn small danger" onclick="window.finDel('${e.id}')" style="padding:2px 6px;font-size:11px;">✕</button>
    </div>
    <div style="font-size:12px;color:var(--c-text-muted);margin-top:3px;">
      ${e.date || ''} ${e.lotId ? '· Lô: ' + esc(e.lotId) : ''}
      ${e.note ? '· ' + esc(e.note).slice(0, 80) : ''}
    </div>
  </div>`;
}

export async function renderFinance() {
  let entries = [];
  let summary = { totalExpense: 0, totalRevenue: 0, profit: 0, expenseCount: 0, revenueCount: 0, byCategory: {} };
  let lotFilter = '';
  try {
    entries = await financeStore.getAll();
    summary = await financeStore.getSummary(lotFilter);
  } catch (_) {}

  const expRows = entries.filter(e => e.type === 'expense').slice(0, 20);
  const revRows = entries.filter(e => e.type === 'revenue').slice(0, 20);

  return `
    <div class="app-header">💰 Tài chính nông trại
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('more')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>

    <div style="display:flex;gap:6px;padding:10px 16px;flex-wrap:wrap;">
      <div class="card" style="flex:1;padding:10px;min-width:80px;">
        <div style="font-size:11px;color:var(--c-text-muted);">Tổng chi</div>
        <div style="font-size:18px;font-weight:800;color:#c62828;">${vnd(summary.totalExpense)}</div>
        <div style="font-size:11px;color:var(--c-text-muted);">${summary.expenseCount} giao dịch</div>
      </div>
      <div class="card" style="flex:1;padding:10px;min-width:80px;">
        <div style="font-size:11px;color:var(--c-text-muted);">Tổng thu</div>
        <div style="font-size:18px;font-weight:800;color:#2E7D32;">${vnd(summary.totalRevenue)}</div>
        <div style="font-size:11px;color:var(--c-text-muted);">${summary.revenueCount} giao dịch</div>
      </div>
      <div class="card" style="flex:1;padding:10px;min-width:80px;border-color:${summary.profit >= 0 ? '#2E7D32' : '#c62828'};">
        <div style="font-size:11px;color:var(--c-text-muted);">Lợi nhuận</div>
        <div style="font-size:18px;font-weight:800;color:${summary.profit >= 0 ? '#2E7D32' : '#c62828'};">${vnd(summary.profit)}</div>
      </div>
    </div>

    <div style="padding:0 16px 8px;display:flex;gap:6px;">
      <button class="btn primary" style="flex:1;font-size:13px;" onclick="document.getElementById('fin-exp-form').style.display='block'">➕ Thêm chi phí</button>
      <button class="btn secondary" style="flex:1;font-size:13px;" onclick="document.getElementById('fin-rev-form').style.display='block'">➕ Thêm doanh thu</button>
    </div>

    <div id="fin-exp-form" style="display:none;padding:12px;margin:0 16px 8px;border:2px solid #c62828;border-radius:10px;">
      <div style="font-weight:700;margin-bottom:8px;">➕ Thêm chi phí</div>
      <select id="fin-exp-cat" class="form">${catOptions('expense')}</select>
      <input id="fin-exp-amount" class="form" type="number" placeholder="Số tiền (VNĐ)" min="0" />
      <input id="fin-exp-lot" class="form" placeholder="Mã lô (để trống nếu chung)" />
      <input id="fin-exp-note" class="form" placeholder="Ghi chú" />
      <input id="fin-exp-date" class="form" type="date" value="${new Date().toISOString().slice(0, 10)}" />
      <button class="btn primary" style="width:100%;margin-top:6px;" onclick="window.finAddExpense()">💾 Lưu chi phí</button>
      <button class="btn secondary" style="width:100%;margin-top:4px;" onclick="this.closest('#fin-exp-form').style.display='none'">Hủy</button>
    </div>

    <div id="fin-rev-form" style="display:none;padding:12px;margin:0 16px 8px;border:2px solid #2E7D32;border-radius:10px;">
      <div style="font-weight:700;margin-bottom:8px;">➕ Thêm doanh thu</div>
      <select id="fin-rev-cat" class="form">${catOptions('revenue')}</select>
      <input id="fin-rev-amount" class="form" type="number" placeholder="Số tiền (VNĐ)" min="0" />
      <input id="fin-rev-lot" class="form" placeholder="Mã lô" />
      <input id="fin-rev-buyer" class="form" placeholder="Người mua" />
      <input id="fin-rev-note" class="form" placeholder="Ghi chú" />
      <input id="fin-rev-date" class="form" type="date" value="${new Date().toISOString().slice(0, 10)}" />
      <button class="btn primary" style="width:100%;margin-top:6px;" onclick="window.finAddRevenue()">💾 Lưu doanh thu</button>
      <button class="btn secondary" style="width:100%;margin-top:4px;" onclick="this.closest('#fin-rev-form').style.display='none'">Hủy</button>
    </div>

    <h3 style="padding:8px 16px 2px;font-size:13px;color:var(--c-text-muted);text-transform:uppercase;">Chi phí gần đây</h3>
    ${expRows.length === 0 ? '<div class="empty" style="padding:20px;"><div class="ico">💸</div><p>Chưa có chi phí nào.</p></div>' : expRows.map(entryRow).join('')}

    <h3 style="padding:8px 16px 2px;margin-top:4px;font-size:13px;color:var(--c-text-muted);text-transform:uppercase;">Doanh thu gần đây</h3>
    ${revRows.length === 0 ? '<div class="empty" style="padding:20px;"><div class="ico">💰</div><p>Chưa có doanh thu nào.</p></div>' : revRows.map(entryRow).join('')}

    <div style="text-align:center;padding:16px;">
      <button class="btn secondary" style="font-size:12px;" onclick="window.finExportCsv()">📥 Xuất CSV</button>
      <span style="display:inline-block;width:8px;"></span>
      <button class="btn secondary" style="font-size:12px;" onclick="window.finRefresh()">🔄 Làm mới</button>
    </div>
  `;
}

window.finDel = async (id) => {
  if (!confirm('Xóa giao dịch này?')) return;
  await financeStore.deleteEntry(id);
  await window.finRefresh();
};

window.finAddExpense = async () => {
  const amount = document.getElementById('fin-exp-amount')?.value;
  if (!amount || +amount <= 0) { window.showToast?.('Nhập số tiền hợp lệ', 'err'); return; }
  await financeStore.addExpense({
    category: document.getElementById('fin-exp-cat')?.value || 'other',
    amount,
    lotId: document.getElementById('fin-exp-lot')?.value || '',
    note: document.getElementById('fin-exp-note')?.value || '',
    date: document.getElementById('fin-exp-date')?.value || ''
  });
  window.showToast?.('✓ Đã thêm chi phí', 'ok');
  window.finRefresh();
};

window.finAddRevenue = async () => {
  const amount = document.getElementById('fin-rev-amount')?.value;
  if (!amount || +amount <= 0) { window.showToast?.('Nhập số tiền hợp lệ', 'err'); return; }
  await financeStore.addRevenue({
    category: document.getElementById('fin-rev-cat')?.value || 'harvest',
    amount,
    lotId: document.getElementById('fin-rev-lot')?.value || '',
    buyer: document.getElementById('fin-rev-buyer')?.value || '',
    note: document.getElementById('fin-rev-note')?.value || '',
    date: document.getElementById('fin-rev-date')?.value || ''
  });
  window.showToast?.('✓ Đã thêm doanh thu', 'ok');
  window.finRefresh();
};

window.finExportCsv = async () => {
  const csv = await financeStore.exportCsv();
  if (!csv) { window.showToast?.('Không có dữ liệu', ''); return; }
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `taichinh_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
};

window.finRefresh = () => {
  document.querySelector('[x-data]').__x?.$data?.nav?.('finance');
};

window.wire_finance = function () {};
