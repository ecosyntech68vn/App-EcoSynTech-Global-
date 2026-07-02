// inventory.js — V5.1 Kho chuẩn ERP: Nhập–Xuất–Tồn có kiểm soát + chứng từ + báo cáo.
// Nguyên tắc: TỒN suy ra từ SỔ CÁI (inventoryStore). Mọi thay đổi đi qua FORM CHỨNG TỪ
// (post() validate: không âm kho, qty>0). Có tồn an toàn cảnh báo, export/import CSV.
import { materialsStore, inventoryStore } from '../db/trace.js';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

const TYPE_LBL = { fertilizer: '🧪 Phân bón', pesticide: '☠️ Thuốc BVTV', other: '📦 Khác' };
const MOVE_LBL = { open: '🟦 Đầu kỳ', import: '⬇ Nhập', export: '⬆ Xuất', transfer: '↔ Chuyển CN', adjustUp: '＋ Điều chỉnh', adjustDown: '－ Điều chỉnh' };

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function fmt(n) { const v = Math.round((parseFloat(n) || 0) * 1000) / 1000; return String(v); }
function today() { return new Date().toISOString().slice(0, 10); }

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
  const safe = await inventoryStore.allSafe();
  const bal = await inventoryStore.balanceMap();

  const rawRows = mats.map(m => ({ id: m.id, name: m.name, type: m.type, unit: (m.stock && m.stock.unit) || '', qty: bal[m.id] || 0, safe: parseFloat(safe[m.id]) || 0 }));
  const lowRaw = rawRows.filter(r => r.safe > 0 && r.qty <= r.safe);
  const lowFg = finished.filter(f => { const s = parseFloat(safe[f.id]) || 0; return s > 0 && f.qty <= s; });
  const inStock = finished.filter(f => f.qty > 0);

  const itemRow = (r, kind) => {
    const s = parseFloat(safe[r.id]) || 0;
    const isLow = s > 0 && r.qty <= s;
    const isOut = r.qty <= 0;
    const std = kind === 'fg' && r.trace ? (r.trace.standards || []).map(x => `<span class="pill completed" style="margin-right:3px;">${esc(x)}</span>`).join('') : '';
    return `
      <div class="card ${isOut ? '' : isLow ? 'warn' : 'ok'}">
        <div class="row">
          <div class="card-title" style="font-size:15px;">${esc(r.name)}</div>
          <span class="pill ${isOut ? 'pending-sync' : isLow ? 'pending-sync' : 'completed'}"><strong>${fmt(r.qty)}</strong> ${esc(r.unit)}${isLow && !isOut ? ' ⚠' : ''}</span>
        </div>
        <div class="card-meta">${kind === 'fg'
          ? 'Lô: <strong>' + esc(r.lotCode || '-') + '</strong>' + (r.harvestDate ? ' · TH ' + esc(r.harvestDate) : '') + (r.trace && r.trace.puc ? ' · PUC ' + esc(r.trace.puc) : '')
          : (TYPE_LBL[r.type] || r.type)}${s > 0 ? ' · An toàn ≥ ' + fmt(s) : ''}</div>
        ${std ? `<div style="margin-top:4px;">${std}</div>` : ''}
        <div style="display:flex; gap:6px; margin-top:8px; flex-wrap:wrap;"
             data-id="${esc(r.id)}" data-kind="${kind === 'fg' ? 'finished' : 'raw'}" data-name="${esc(r.name)}" data-unit="${esc(r.unit)}">
          <button class="inv-act btn secondary" data-act="import" style="padding:6px 12px; font-size:13px;">⬇ Nhập</button>
          ${r.qty > 0 ? `<button class="inv-act btn secondary" data-act="export" style="padding:6px 12px; font-size:13px;">⬆ Xuất</button>` : ''}
          ${r.qty > 0 ? `<button class="inv-act btn secondary" data-act="transfer" style="padding:6px 12px; font-size:13px;">↔ Chuyển CN</button>` : ''}
          <button class="inv-act btn secondary" data-act="adjust" style="padding:6px 12px; font-size:13px;">📋 Kiểm kê</button>
          <button class="inv-safe btn secondary" style="padding:6px 12px; font-size:13px;">⚙ Tồn an toàn</button>
        </div>
      </div>`;
  };

  return `
    <div class="app-header">🏬 Kho — Nhập · Xuất · Tồn
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('more')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>

    <div style="display:flex; gap:8px; padding:12px 16px;">
      ${stat('Mã thành phẩm', inStock.length, '#2E7D32')}
      ${stat('Loại vật tư', mats.length, '#1565C0')}
      ${stat('Sắp hết / hết', (lowRaw.length + lowFg.length), (lowRaw.length + lowFg.length) ? '#c62828' : '#999')}
    </div>

    <div style="display:flex; gap:8px; padding:0 16px 6px; flex-wrap:wrap;">
      <button id="inv-exp-stock" class="btn secondary" style="flex:1; min-width:130px; padding:8px; font-size:13px;">📊 CSV tồn kho</button>
      <button id="inv-exp-moves" class="btn secondary" style="flex:1; min-width:130px; padding:8px; font-size:13px;">🧾 CSV sổ nhập-xuất</button>
      <button id="inv-import" class="btn secondary" style="flex:1; min-width:130px; padding:8px; font-size:13px;">⬆ Nhập từ CSV</button>
      <button id="inv-tpl" class="btn secondary" style="flex:1; min-width:130px; padding:8px; font-size:13px;">📥 Tải mẫu CSV</button>
    </div>
    <input type="file" id="inv-file" accept=".csv,text/csv" style="display:none;" />

    <h3 style="padding:8px 16px 4px; color:var(--c-text-muted); font-size:13px; text-transform:uppercase;">Thành phẩm trong kho (${inStock.length})</h3>
    ${finished.length === 0
      ? `<div class="empty" style="padding:16px;"><p>Chưa có thành phẩm. Thu hoạch một lô → sản lượng tự vào kho tại đây.</p></div>`
      : finished.map(f => itemRow(f, 'fg')).join('')}

    <h3 style="padding:14px 16px 4px; color:var(--c-text-muted); font-size:13px; text-transform:uppercase;">Vật tư tồn kho (${mats.length})
      <span style="float:right; text-transform:none;"><a onclick="document.querySelector('[x-data]').__x.$data.nav('materials')" style="color:var(--c-primary,#1565C0); cursor:pointer; font-size:12px;">Danh mục chi tiết →</a></span>
    </h3>
    ${rawRows.map(r => itemRow(r, 'raw')).join('')}

    <h3 style="padding:14px 16px 4px; color:var(--c-text-muted); font-size:13px; text-transform:uppercase;">Sổ nhập / xuất / tồn (${moves.length})</h3>
    ${moves.length === 0 ? `<div class="empty" style="padding:16px;"><p>Chưa có chuyển động kho.</p></div>` : ''}
    ${moves.slice(0, 60).map(mv => {
      const d = mv.doc || {};
      const docline = [d.pxk && 'PXK ' + d.pxk, d.invoiceNo && 'HĐ ' + d.invoiceNo, d.party, d.origin && 'Nguồn ' + d.origin, mv.to && '→ ' + mv.to, d.operator && 'NV ' + d.operator].filter(Boolean).map(esc).join(' · ');
      return `
      <div class="card">
        <div class="row">
          <div class="card-title" style="font-size:14px;">${MOVE_LBL[mv.type] || mv.type} · ${esc(mv.itemName || '')}</div>
          <span class="card-meta">${esc(new Date(mv.ts).toLocaleString('vi-VN'))}</span>
        </div>
        <div class="card-meta">${mv.kind === 'finished' ? 'Thành phẩm' : 'Vật tư'} · <strong>${fmt(mv.qty)}</strong> ${esc(mv.unit || '')}${(d.docDate ? ' · CT ' + esc(d.docDate) : '')}${mv.note ? ' · ' + esc(mv.note) : ''}</div>
        ${docline ? `<div class="card-meta" style="color:var(--c-text-muted);">${docline}</div>` : ''}
      </div>`;
    }).join('')}

    <div style="height:24px;"></div>
    <div id="inv-modal-root"></div>
  `;
}

// ============ MODAL CHỨNG TỪ ============
function field(label, name, opts = {}) {
  const t = opts.type || 'text';
  return `<label style="display:block; margin-top:8px; font-size:13px; color:var(--c-text-muted);">${label}${opts.req ? ' *' : ''}</label>
    <input name="${name}" type="${t}" ${opts.step ? 'step="' + opts.step + '"' : ''} ${opts.min != null ? 'min="' + opts.min + '"' : ''} value="${opts.value != null ? esc(opts.value) : ''}" placeholder="${esc(opts.ph || '')}" ${opts.req ? 'required' : ''} style="width:100%; padding:9px; border:1px solid var(--c-border); border-radius:8px; box-sizing:border-box;" />`;
}

function openModal(html) {
  const root = document.getElementById('inv-modal-root');
  if (!root) return null;
  root.innerHTML = `<div class="inv-ov" style="position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:9999; display:flex; align-items:flex-end; justify-content:center;">
    <div style="background:#fff; width:100%; max-width:520px; max-height:88vh; overflow:auto; border-radius:16px 16px 0 0; padding:16px 18px 22px;">${html}</div>
  </div>`;
  root.querySelector('.inv-ov').addEventListener('click', e => { if (e.target.classList.contains('inv-ov')) root.innerHTML = ''; });
  return root;
}
function closeModal() { const r = document.getElementById('inv-modal-root'); if (r) r.innerHTML = ''; }

window.wire_inventory = function () {
  const nav = () => document.querySelector('[x-data]').__x.$data.nav('inventory');
  const toast = (m, t) => window.showToast && window.showToast(m, t || '');

  // ---- Mở form chứng từ Nhập/Xuất/Chuyển/Kiểm kê ----
  document.querySelectorAll('.inv-act').forEach(b => b.addEventListener('click', async () => {
    const d = b.parentElement.dataset;
    const act = b.dataset.act;
    const { id, kind, name, unit } = d;
    const cur = await inventoryStore.balanceOf(id);   // tồn hiện có (để hiện + nhắc trước khi xuất)
    const TITLE = { import: '⬇ Nhập kho', export: '⬆ Xuất kho', transfer: '↔ Chuyển chi nhánh', adjust: '📋 Kiểm kê (đặt tồn thực tế)' };
    const partyLbl = act === 'export' ? 'Người mua / khách hàng' : 'Nhà cung cấp';

    // Hộp tồn hiện có: SỐ to + đơn vị kèm bên (vd "500 kg")
    const balBox = `<div style="background:#f1f8e9; border:1px solid #c5e1a5; border-radius:10px; padding:10px 14px; margin-bottom:6px; display:flex; align-items:baseline; gap:8px;">
        <span style="font-size:12px; color:var(--c-text-muted);">Tồn hiện có</span>
        <span style="font-size:26px; font-weight:800; color:#2E7D32; margin-left:auto;">${fmt(cur)}</span>
        <span style="font-size:15px; color:#2E7D32; font-weight:700;">${esc(unit || '—')}</span>
      </div>`;
    const hint = (act === 'export' || act === 'transfer')
      ? `<div style="font-size:12px; color:#ef6c00; margin-bottom:6px;">⚠ Không được ${act === 'export' ? 'xuất' : 'chuyển'} quá tồn hiện có (${fmt(cur)} ${esc(unit || '')}).</div>` : '';

    let body = '';
    if (act === 'adjust') {
      body = field('Tồn thực tế đếm được', 'realQty', { type: 'number', step: '0.001', min: '0', req: true, ph: 'Số lượng kiểm kê thực tế' })
        + field('Ngày kiểm kê', 'docDate', { type: 'date', value: today() })
        + field('Người kiểm kê', 'operator', {})
        + field('Ghi chú', 'note', { ph: 'Lý do chênh lệch...' });
    } else {
      body = field('Số lượng', 'qty', { type: 'number', step: '0.001', min: '0', req: true, ph: 'Bắt buộc > 0' })
        + field('Đơn vị', 'unit', { value: unit, ph: 'kg, chai, gói...' })
        + field('Ngày chứng từ', 'docDate', { type: 'date', value: today() });
      if (act === 'transfer') body += field('Chuyển đến (chi nhánh / trang trại)', 'toFarm', { req: true, ph: 'Tên CN / mã trang trại' });
      body += field('Số phiếu (PNK/PXK)', 'pxk', { ph: 'Số phiếu nhập/xuất kho' });
      if (act !== 'transfer') {
        body += field('Số hóa đơn', 'invoiceNo', { ph: 'Số hóa đơn (nếu có)' })
          + field(partyLbl, 'party', { ph: act === 'export' ? 'Tên khách mua' : 'Tên NCC' });
        if (act === 'import') body += field('Nguồn gốc / xuất xứ', 'origin', { ph: 'Vùng/nhà SX, lô NCC...' });
      }
      body += field('Người thao tác', 'operator', {})
        + field('Ghi chú', 'note', {});
    }
    openModal(`
      <div style="font-weight:700; font-size:17px; margin-bottom:2px;">${TITLE[act]}</div>
      <div style="color:var(--c-text-muted); font-size:13px; margin-bottom:8px;">${esc(name)} · ${kind === 'finished' ? 'Thành phẩm' : 'Vật tư'}</div>
      ${balBox}${hint}
      <form id="inv-doc-form">${body}
        <div id="inv-err" style="display:none; background:#ffebee; border:1px solid #ef9a9a; color:#c62828; border-radius:8px; padding:9px 12px; margin-top:10px; font-size:13px; font-weight:600;"></div>
        <div style="display:flex; gap:10px; margin-top:14px;">
          <button type="button" class="btn secondary inv-cancel" style="flex:1;">Hủy</button>
          <button type="submit" class="btn" style="flex:1;">Lưu chứng từ</button>
        </div>
      </form>`);
    const showErr = m => { const e = document.getElementById('inv-err'); if (e) { e.textContent = '⚠ ' + m; e.style.display = 'block'; } else toast('✗ ' + m, 'err'); };
    document.querySelector('.inv-cancel')?.addEventListener('click', closeModal);
    document.getElementById('inv-doc-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        if (act === 'adjust') {
          const real = parseFloat(fd.get('realQty'));
          if (!(real >= 0)) { showErr('Tồn thực tế không hợp lệ'); return; }
          const now = await inventoryStore.balanceOf(id);
          const delta = Math.round((real - now) * 1000) / 1000;
          if (delta === 0) { toast('Tồn khớp sổ, không cần điều chỉnh', 'ok'); closeModal(); return; }
          await inventoryStore.post({
            kind, itemId: id, itemName: name, type: delta > 0 ? 'adjustUp' : 'adjustDown',
            qty: Math.abs(delta), unit, allowNeg: true,
            doc: { docDate: fd.get('docDate') || today(), operator: fd.get('operator') || '', origin: 'Kiểm kê' },
            note: 'Kiểm kê: sổ ' + fmt(now) + ' → thực tế ' + fmt(real) + (fd.get('note') ? ' · ' + fd.get('note') : '')
          });
        } else {
          await inventoryStore.post({
            kind, itemId: id, itemName: name, type: act,
            qty: fd.get('qty'), unit: fd.get('unit') || unit,
            to: act === 'transfer' ? (fd.get('toFarm') || '') : undefined,
            doc: {
              pxk: fd.get('pxk') || '', invoiceNo: fd.get('invoiceNo') || '',
              docDate: fd.get('docDate') || today(), party: fd.get('party') || '',
              origin: fd.get('origin') || '', operator: fd.get('operator') || ''
            },
            note: fd.get('note') || ''
          });
        }
        toast('✓ Đã ghi chứng từ', 'ok'); closeModal(); nav();
      } catch (err) { showErr(err.message); }   // cảnh báo hiện NGAY trong khung, không đóng modal
    });
  }));

  // ---- Set tồn an toàn ----
  document.querySelectorAll('.inv-safe').forEach(b => b.addEventListener('click', async () => {
    const d = b.parentElement.dataset;
    const cur = await inventoryStore.getSafe(d.id);
    openModal(`
      <div style="font-weight:700; font-size:17px;">⚙ Tồn an toàn</div>
      <div style="color:var(--c-text-muted); font-size:13px; margin-bottom:6px;">${esc(d.name)} — cảnh báo khi tồn ≤ ngưỡng này.</div>
      <form id="inv-safe-form">${field('Ngưỡng tồn an toàn (' + esc(d.unit || 'đơn vị') + ')', 'safe', { type: 'number', step: '0.001', min: '0', value: cur || '', ph: '0 = tắt cảnh báo' })}
        <div style="display:flex; gap:10px; margin-top:16px;">
          <button type="button" class="btn secondary inv-cancel" style="flex:1;">Hủy</button>
          <button type="submit" class="btn" style="flex:1;">Lưu</button>
        </div>
      </form>`);
    document.querySelector('.inv-cancel')?.addEventListener('click', closeModal);
    document.getElementById('inv-safe-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      await inventoryStore.setSafe(d.id, new FormData(e.target).get('safe'));
      toast('✓ Đã đặt tồn an toàn', 'ok'); closeModal(); nav();
    });
  }));

  // ---- Export CSV ----
  document.getElementById('inv-exp-stock')?.addEventListener('click', exportStockCsv);
  document.getElementById('inv-exp-moves')?.addEventListener('click', exportMovesCsv);
  document.getElementById('inv-tpl')?.addEventListener('click', downloadTemplate);

  // ---- Import CSV ----
  const fileInput = document.getElementById('inv-file');
  document.getElementById('inv-import')?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', async () => {
    const f = fileInput.files && fileInput.files[0]; if (!f) return;
    try {
      const text = await f.text();
      const done = await importCsv(text);
      // Hiện bảng kết quả rõ ràng (thay cho toast thoáng qua)
      openModal(`
        <div style="font-weight:700; font-size:17px;">✓ Đã nhập ${done.length} dòng từ CSV</div>
        <div style="color:var(--c-text-muted); font-size:13px; margin:4px 0 10px;">Đã ghi chứng từ NHẬP cho các vật tư sau:</div>
        <div style="max-height:50vh; overflow:auto;">
          ${done.map((r, i) => `<div class="row" style="padding:8px 0; border-bottom:1px solid var(--c-border);">
            <div><strong>${i + 1}. ${esc(r.name)}</strong>${r.created ? ' <span class="pill completed" style="font-size:10px;">mới</span>' : ''}</div>
            <div style="font-weight:700; color:#2E7D32;">+${fmt(r.qty)} ${esc(r.unit || '')}</div>
          </div>`).join('')}
        </div>
        <button type="button" class="btn inv-cancel" style="margin-top:14px; width:100%;">Xong</button>`);
      document.querySelector('.inv-cancel')?.addEventListener('click', () => { closeModal(); nav(); });
    } catch (err) { toast('✗ Lỗi đọc CSV: ' + err.message, 'err'); }
    fileInput.value = '';
  });
};

// ============ CSV helpers ============
function csvCell(v) {
  let s = String(v == null ? '' : v);
  if (/^[=+\-@\t]/.test(s)) s = '\t' + s;
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function toCsv(rows) { return '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n'); }
const isNative = () => { try { return Capacitor.isNativePlatform && Capacitor.isNativePlatform(); } catch (_) { return false; } };

// Ghi CSV ra FILE THẬT. Web → tải về. Android → lưu Documents/EcoSynTech + mở Share (Zalo/Drive/Files).
async function saveCsv(filename, csv) {
  if (!isNative()) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
    window.showToast && window.showToast('✓ Đã tải ' + filename, 'ok');
    return;
  }
  // 1) Ghi vào Cache để Share (FileProvider của plugin xử lý, không lỗi FileUriExposed)
  await Filesystem.writeFile({ path: filename, data: csv, directory: Directory.Cache, encoding: Encoding.UTF8 });
  const { uri } = await Filesystem.getUri({ directory: Directory.Cache, path: filename });
  // 2) Lưu bản lâu dài để mở lại bằng ứng dụng Files
  let saved = 'bộ nhớ tạm';
  try {
    await Filesystem.writeFile({ path: 'EcoSynTech/' + filename, data: csv, directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
    saved = 'Documents/EcoSynTech/' + filename;
  } catch (_) {}
  // 3) Mở Share để chọn nơi lưu/gửi
  try { await Share.share({ title: filename, text: 'Báo cáo kho EcoSynTech', files: [uri] }); } catch (_) {}
  window.showToast && window.showToast('✓ Đã lưu: ' + saved + ' — chọn app để mở/gửi', 'ok');
}

async function exportStockCsv() {
  const mats = await materialsStore.list();
  const finished = await inventoryStore.finishedList();
  const bal = await inventoryStore.balanceMap();
  const safe = await inventoryStore.allSafe();
  const rows = [['Mã', 'Tên', 'Nhóm', 'Loại', 'Đơn vị', 'Tồn hiện có', 'Tồn an toàn', 'Trạng thái']];
  const status = (q, s) => q <= 0 ? 'Hết' : (s > 0 && q <= s ? 'Sắp hết' : 'OK');
  for (const f of finished) { const s = parseFloat(safe[f.id]) || 0; rows.push([f.id, f.name, 'Thành phẩm', 'Lô ' + (f.lotCode || ''), f.unit || '', fmt(f.qty), s || '', status(f.qty, s)]); }
  for (const m of mats) { const q = bal[m.id] || 0; const s = parseFloat(safe[m.id]) || 0; rows.push([m.id, m.name, 'Vật tư', TYPE_LBL[m.type] || m.type, (m.stock && m.stock.unit) || '', fmt(q), s || '', status(q, s)]); }
  await saveCsv('ecosyntech-ton-kho-' + today() + '.csv', toCsv(rows));
}

async function exportMovesCsv() {
  const moves = await inventoryStore.movements();
  const rows = [['Thời gian', 'Loại CT', 'Nhóm', 'Mã', 'Tên', 'Số lượng', 'Đơn vị', 'Số phiếu', 'Số HĐ', 'Ngày CT', 'Đối tác', 'Nguồn gốc', 'Người TT', 'Chuyển đến', 'Ghi chú']];
  for (const mv of moves) {
    const d = mv.doc || {};
    rows.push([new Date(mv.ts).toLocaleString('vi-VN'), (MOVE_LBL[mv.type] || mv.type).replace(/^[^\w\sÀ-ỹ]+\s*/, ''), mv.kind === 'finished' ? 'Thành phẩm' : 'Vật tư', mv.itemId, mv.itemName || '', fmt(mv.qty), mv.unit || '', d.pxk || '', d.invoiceNo || '', d.docDate || '', d.party || '', d.origin || '', d.operator || '', mv.to || '', mv.note || '']);
  }
  await saveCsv('ecosyntech-so-nhap-xuat-' + today() + '.csv', toCsv(rows));
}

async function downloadTemplate() {
  const rows = [
    ['Ten', 'Loai', 'DonVi', 'SoLuong', 'NgayCT', 'NhaCC', 'NguonGoc', 'GhiChu'],
    ['NPK 16-16-8', 'fertilizer', 'bao 50kg', '20', today(), 'Đại lý ABC', 'Bình Điền', 'Nhập đầu vụ'],
    ['Abamectin 3.6EC', 'pesticide', 'chai 1L', '12', today(), 'Cửa hàng BVTV X', '', ''],
  ];
  await saveCsv('mau-nhap-vat-tu.csv', toCsv(rows));
}

// Parser CSV gọn (hỗ trợ ô có dấu phẩy/xuống dòng trong ngoặc kép)
function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (c === '\r') { /* skip */ }
      else cell += c;
    }
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim() !== ''));
}

// Import: mỗi dòng = NHẬP vật tư (khớp tên có sẵn, hoặc tạo mới) + ghi chứng từ "import".
async function importCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) throw new Error('File trống');
  const header = rows[0].map(h => String(h).trim().toLowerCase());
  const col = (...names) => { for (const n of names) { const i = header.indexOf(n); if (i >= 0) return i; } return -1; };
  const ci = { name: col('ten', 'tên', 'name'), type: col('loai', 'loại', 'type'), unit: col('donvi', 'đơn vị', 'unit'), qty: col('soluong', 'số lượng', 'qty', 'sl'), date: col('ngayct', 'ngày ct', 'date'), ncc: col('nhacc', 'nhà cc', 'supplier', 'ncc'), origin: col('nguongoc', 'nguồn gốc', 'origin'), note: col('ghichu', 'ghi chú', 'note') };
  if (ci.name < 0 || ci.qty < 0) throw new Error('Thiếu cột Ten hoặc SoLuong');
  const mats = await materialsStore.list();
  const byName = {}; mats.forEach(m => byName[m.name.trim().toLowerCase()] = m);
  const done = [];
  for (let r = 1; r < rows.length; r++) {
    const c = rows[r];
    const name = (c[ci.name] || '').trim(); if (!name) continue;
    const qty = parseFloat(c[ci.qty]); if (!(qty > 0)) continue;
    const unit = ci.unit >= 0 ? (c[ci.unit] || '').trim() : '';
    let mat = byName[name.toLowerCase()]; let created = false;
    if (!mat) {
      mat = await materialsStore.add({ name, type: ci.type >= 0 ? ((c[ci.type] || 'other').trim() || 'other') : 'other', phiDays: 0, stockUnit: unit });
      byName[name.toLowerCase()] = mat; created = true;
    }
    const u = unit || (mat.stock && mat.stock.unit) || '';
    await inventoryStore.post({
      kind: 'raw', itemId: mat.id, itemName: mat.name, type: 'import', qty, unit: u,
      doc: { docDate: (ci.date >= 0 && c[ci.date]) ? c[ci.date].trim() : today(), party: ci.ncc >= 0 ? (c[ci.ncc] || '').trim() : '', origin: ci.origin >= 0 ? (c[ci.origin] || '').trim() : '' },
      note: 'Nhập từ CSV' + (ci.note >= 0 && c[ci.note] ? ' · ' + c[ci.note].trim() : '')
    });
    done.push({ name: mat.name, qty, unit: u, created });
  }
  if (done.length === 0) throw new Error('Không có dòng hợp lệ (cần Ten + SoLuong>0)');
  return done;
}
