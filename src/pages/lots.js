// lots.js — V3.1 Truy xuất nguồn gốc: danh sách lô, tạo lô, chi tiết timeline,
// thu hoạch (PHI guard), QR truy xuất + Phiếu truy xuất PDF.
// PDF render qua canvas (hỗ trợ tiếng Việt đầy đủ) → jsPDF addImage.
import { lotStore, materialsStore, ACTIVITY_LABELS, validateGTIN, generateGTIN13, formatGTIN, formatGS1AIString, formatGS1AIHuman, gs1DigitalLink, encodeGS1128Barcode, drawGS1128, validatePUC, formatPUC } from '../db/trace.js';
import { authStore } from '../stores/auth.js';
import { hasFeature, TRACE_BASIC_MAX_LOTS, PLANS } from '../stores/plan.js';
import { blockchainStore } from '../stores/blockchain.js';
import qrcode from 'qrcode-generator';

let currentLotId = null; // state: null = list view, khác null = detail view

export async function renderLots() {
  if (currentLotId) return renderLotDetail(currentLotId);
  return renderLotList();
}

// ===== LIST + CREATE =====
async function renderLotList() {
  const lots = await lotStore.list();
  return `
    <div class="app-header">🌾 Truy xuất nguồn gốc
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('more')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>

    <div class="form" style="padding-bottom:0;">
      <details id="lot-create-box">
        <summary class="btn" style="display:block; text-align:center; cursor:pointer; list-style:none;">＋ Tạo lô / mùa vụ mới</summary>
        <form id="lot-form" style="margin-top:12px;">
          <label>Cây trồng *</label>
          <input name="crop" required placeholder="Rau muống, Cà chua, Xoài..." />
          <label>Giống</label>
          <input name="variety" placeholder="Giống/xuất xứ hạt giống" />
          <label>Zone</label>
          <input name="zoneId" placeholder="Z1, Z2..." />
          <label>Diện tích</label>
          <input name="area" placeholder="500 m², 0.2 ha..." />
          <label>Ngày xuống giống</label>
          <input name="plantedAt" type="date" value="${new Date().toISOString().slice(0,10)}" />
          <label>Ghi chú</label>
          <textarea name="note" placeholder="Nguồn giống, xử lý đất..."></textarea>

          <details style="margin-top:10px; border:1px solid #ddd; border-radius:8px; padding:10px;">
            <summary style="cursor:pointer; font-weight:600; font-size:13px; list-style:none;">📋 Hồ sơ chuẩn truy xuất / xuất khẩu — GS1 · VietGAP · EU · Nhật (tuỳ chọn)</summary>
            <p style="font-size:12px; color:var(--c-text-muted); margin:6px 0;">Điền nếu cần tem chuẩn quốc tế hoặc xuất khẩu. Bỏ trống vẫn tạo lô bình thường.</p>

            <label>Chuẩn áp dụng</label>
            <div style="display:flex; flex-wrap:wrap; gap:6px 14px; margin:4px 0 8px;">
              ${['VietGAP','GlobalGAP','EU-Organic','JGAP/JAS'].map(s => `
              <label style="display:flex; align-items:center; gap:4px; font-weight:400;">
                <input type="checkbox" name="std" value="${s}" /> ${s}</label>`).join('')}
            </div>

            <label>Mã số vùng trồng (PUC — VietGAP / Cục BVTV)</label>
            <input name="puc" placeholder="VD: VN-TQ-0123 (bắt buộc khi xuất khẩu)" />

            <label>Thị trường đích</label>
            <select name="market">
              <option value="">— Chọn —</option>
              <option value="noi-dia">Nội địa</option>
              <option value="EU">EU</option>
              <option value="JP">Nhật Bản</option>
              <option value="US">Mỹ</option>
              <option value="CN">Trung Quốc</option>
            </select>

            <label>GTIN sản phẩm (GS1) <span id="lot-gtin-msg" style="font-size:11px;font-weight:400;"></span></label>
            <div style="display:flex;gap:4px;">
              <input name="gtin" id="lot-gtin" inputmode="numeric" placeholder="Nhập 12 số → tự sinh check digit" style="flex:3;" />
              <button type="button" class="btn small" style="font-size:10px;" onclick="window.lotAutoGTIN()">Sinh</button>
            </div>
            <label>GLN cơ sở (GS1)</label>
            <input name="gln" inputmode="numeric" placeholder="Mã địa điểm toàn cầu 13 số" />

            <label>Cơ sở sản xuất</label>
            <input name="producer" placeholder="Tên HTX / trang trại" />
            <label>Địa chỉ vùng trồng</label>
            <input name="address" placeholder="Thôn, xã, huyện, tỉnh" />

            <label>Số giấy chứng nhận GAP</label>
            <input name="certNo" placeholder="Số GCN" />
            <label>Tổ chức chứng nhận</label>
            <input name="certBody" placeholder="VD: Vinacert, Control Union, JONA" />
            <label>Chứng nhận hết hạn</label>
            <input name="certExpiry" type="date" />

            <label>Nguồn giống (truy xuất ngược — EU 178/2002)</label>
            <input name="seedSource" placeholder="Nhà cung cấp giống + số lô giống" />
          </details>

          <button type="submit" class="btn" style="margin-top:10px;">Tạo lô</button>
        </form>
      </details>
    </div>

    <h3 style="padding:14px 16px 4px; color:var(--c-text-muted); font-size:13px; text-transform:uppercase;">Lô đang quản lý (${lots.length})</h3>
    ${lots.length === 0 ? `<div class="empty" style="padding:20px;"><p>Chưa có lô nào. Tạo lô đầu tiên để bắt đầu chuỗi truy xuất.</p></div>` : ''}
    ${lots.map(l => {
      const phi = lotStore.phiStatus(l);
      const statusPill = l.status === 'growing'
        ? (phi.locked ? `<span class="pill pending-sync">🔒 PHI ${phi.daysLeft}d</span>` : `<span class="pill completed">Đang canh tác</span>`)
        : l.status === 'harvested' ? `<span class="pill completed">✓ Đã thu hoạch</span>` : `<span class="pill">Đã đóng</span>`;
      return `
      <div class="card" data-lot="${escapeHtml(l.id)}" style="cursor:pointer;">
        <div class="row">
          <div class="card-title">${escapeHtml(l.crop)}${l.variety ? ' · ' + escapeHtml(l.variety) : ''}</div>
          ${statusPill}
        </div>
        <div class="card-meta">Mã lô: <strong>${escapeHtml(l.code)}</strong>${l.zoneId ? ' · Zone ' + escapeHtml(l.zoneId) : ''}</div>
        <div class="card-meta">Xuống giống: ${escapeHtml(l.plantedAt)}${l.harvest ? ' · Thu hoạch: ' + escapeHtml(l.harvest.date) + ' (' + escapeHtml(String(l.harvest.qty)) + ' ' + escapeHtml(l.harvest.unit) + ')' : ''}</div>
      </div>`;
    }).join('')}
  `;
}

// ===== DETAIL =====
async function renderLotDetail(lotId) {
  const lot = await lotStore.byId(lotId);
  if (!lot) { currentLotId = null; return renderLotList(); }
  const events = await lotStore.events(lotId);
  const phi = lotStore.phiStatus(lot);
  const isManager = authStore.role === 'manager' || authStore.role === 'admin';

  return `
    <div class="app-header">🌾 ${escapeHtml(lot.code)}
      <button id="lot-back" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>

    <div class="card">
      <div class="row">
        <div class="card-title">${escapeHtml(lot.crop)}${lot.variety ? ' · ' + escapeHtml(lot.variety) : ''}</div>
        <span class="pill ${lot.status === 'growing' ? 'completed' : ''}">${lot.status === 'growing' ? 'Đang canh tác' : lot.status === 'harvested' ? '✓ Đã thu hoạch' : 'Đã đóng'}</span>
      </div>
      <div class="card-meta">Farm ${escapeHtml(lot.farmId)}${lot.zoneId ? ' · Zone ' + escapeHtml(lot.zoneId) : ''}${lot.area ? ' · ' + escapeHtml(lot.area) : ''}</div>
      <div class="card-meta">Xuống giống: ${escapeHtml(lot.plantedAt)} · ${events.length} sự kiện đã ghi</div>
      ${lot.note ? `<p style="margin:6px 0 0; font-size:13px;">${escapeHtml(lot.note)}</p>` : ''}
    </div>

    ${(lot.trace && (lot.trace.puc || (lot.trace.standards||[]).length || lot.trace.gtin || lot.trace.gln || lot.trace.producer || lot.trace.certNo || lot.trace.market || lot.trace.seedSource)) ? `
    <div class="card">
      <div class="card-title">📋 Hồ sơ chuẩn truy xuất</div>
      ${(lot.trace.standards||[]).length ? `<div style="margin:6px 0;">${lot.trace.standards.map(s=>`<span class="pill completed" style="margin-right:4px;">${escapeHtml(s)}</span>`).join('')}</div>` : ''}
      ${lot.trace.puc ? `<div class="card-meta">Mã vùng trồng (PUC): <strong>${escapeHtml(lot.trace.puc)}</strong></div>` : ''}
      ${lot.trace.market ? `<div class="card-meta">Thị trường đích: <strong>${escapeHtml(lot.trace.market)}</strong></div>` : ''}
      ${lot.trace.gtin ? `<div class="card-meta">GTIN (GS1): ${escapeHtml(lot.trace.gtin)}</div>` : ''}
      ${lot.trace.gln ? `<div class="card-meta">GLN (GS1): ${escapeHtml(lot.trace.gln)}</div>` : ''}
      ${lot.trace.producer ? `<div class="card-meta">Cơ sở: ${escapeHtml(lot.trace.producer)}${lot.trace.address ? ' — ' + escapeHtml(lot.trace.address) : ''}</div>` : ''}
      ${lot.trace.certNo ? `<div class="card-meta">Chứng nhận: ${escapeHtml(lot.trace.certNo)}${lot.trace.certBody ? ' (' + escapeHtml(lot.trace.certBody) + ')' : ''}${lot.trace.certExpiry ? ' · HSD ' + escapeHtml(lot.trace.certExpiry) : ''}</div>` : ''}
      ${lot.trace.seedSource ? `<div class="card-meta">Nguồn giống: ${escapeHtml(lot.trace.seedSource)}</div>` : ''}
    </div>` : ''}

    ${phi.locked ? `
    <div class="card crit">
      <div class="card-title">🔒 Khoá thu hoạch — thời gian cách ly (PHI)</div>
      <div class="card-meta">Thuốc: <strong>${escapeHtml(phi.source)}</strong> · Còn <strong>${phi.daysLeft} ngày</strong> (đến ${new Date(phi.until).toLocaleDateString('vi-VN')})</div>
      <div class="card-meta">Thu hoạch trước hạn = tồn dư thuốc BVTV vượt ngưỡng — vi phạm VietGAP/an toàn thực phẩm.</div>
    </div>` : ''}

    ${lot.status === 'growing' ? `
    <div class="form" style="padding-top:0;">
      <details>
        <summary class="btn secondary" style="display:block; text-align:center; cursor:pointer; list-style:none;">＋ Ghi hoạt động vào lô</summary>
        <form id="lot-evt-form" style="margin-top:12px;">
          <label>Hoạt động</label>
          <select name="type" id="evt-type">
            ${Object.entries(ACTIVITY_LABELS).filter(([k]) => !['planting','harvest'].includes(k)).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
          </select>
          <div id="evt-material-box" style="display:none;">
            <label>Vật tư sử dụng</label>
            <select name="materialId" id="evt-material"></select>
            <label>Liều lượng</label>
            <div style="display:flex; gap:8px;">
              <input name="dose" placeholder="VD: 20" style="flex:2;" />
              <input name="doseUnit" placeholder="ml/10L, kg/sào..." style="flex:3;" />
            </div>
            <div id="evt-phi-warn" class="card-meta" style="color:#c62828;"></div>
          </div>
          <label>Ghi chú</label>
          <textarea name="note"></textarea>
          <button type="submit" class="btn" style="margin-top:10px;">Ghi sự kiện</button>
        </form>
      </details>

      <details style="margin-top:10px;">
        <summary class="btn" style="display:block; text-align:center; cursor:pointer; list-style:none;">🌾 Thu hoạch lô này</summary>
        <form id="lot-harvest-form" style="margin-top:12px;">
          <label>Sản lượng</label>
          <div style="display:flex; gap:8px;">
            <input name="qty" type="number" step="0.1" required placeholder="VD: 150" style="flex:2;" />
            <select name="unit" style="flex:1;"><option>kg</option><option>tấn</option><option>thùng</option><option>bó</option></select>
          </div>
          <label>Ngày thu hoạch</label>
          <input name="date" type="date" value="${new Date().toISOString().slice(0,10)}" />
          ${phi.locked && isManager ? `
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer; color:#c62828;">
            <input type="checkbox" name="overridePhi" />
            <span>⚠ Override khoá PHI (Manager) — sẽ ghi vào hồ sơ truy xuất</span>
          </label>` : ''}
          <button type="submit" class="btn ${phi.locked ? 'danger' : ''}" style="margin-top:10px;">${phi.locked ? '🔒 Thu hoạch (đang khoá PHI)' : 'Xác nhận thu hoạch'}</button>
        </form>
      </details>
    </div>` : ''}

    ${lot.status === 'harvested' || lot.status === 'closed' ? `
    <div class="card ok">
      <div class="card-title">✓ Thu hoạch: ${escapeHtml(String(lot.harvest?.qty || '-'))} ${escapeHtml(lot.harvest?.unit || '')} · ${escapeHtml(lot.harvest?.date || '')}</div>
      ${lot.harvest?.phiOverridden ? '<div class="card-meta" style="color:#c62828;">⚠ Lô này thu hoạch khi còn PHI (đã override) — ghi nhận trong hồ sơ</div>' : ''}
      <div style="text-align:center; margin-top:12px;">
        <div id="lot-qr" style="display:inline-block; background:white; padding:12px; border-radius:8px;"></div>
        <div class="card-meta" style="margin-top:6px;">${escapeHtml(lotStore.traceUrl(lot))}</div>
      </div>
      <button id="lot-pdf" class="btn" style="margin-top:12px; width:100%;">📄 Xuất Phiếu truy xuất (PDF)</button>
    </div>` : ''}

    <h3 style="padding:14px 16px 4px; color:var(--c-text-muted); font-size:13px; text-transform:uppercase;">Nhật ký lô (append-only · ${events.length})</h3>
    ${events.slice().reverse().map(e => `
      <div class="card">
        <div class="row">
          <div class="card-title" style="font-size:14px;">${ACTIVITY_LABELS[e.type] || e.type}</div>
          <span class="card-meta">${new Date(e.ts).toLocaleString('vi-VN')}</span>
        </div>
        ${e.materialName ? `<div class="card-meta">Vật tư: <strong>${escapeHtml(e.materialName)}</strong>${e.dose ? ' · ' + escapeHtml(e.dose) + ' ' + escapeHtml(e.doseUnit || '') : ''}</div>` : ''}
        ${e.note ? `<p style="margin:4px 0 0; font-size:13px;">${escapeHtml(e.note)}</p>` : ''}
        ${e.gps && e.gps.lat ? `<div class="card-meta">📍 ${Number(e.gps.lat).toFixed(5)}, ${Number(e.gps.lng).toFixed(5)}</div>` : ''}
      </div>`).join('')}
  `;
}

function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// ===== WIRING =====
window.lotAutoGTIN = () => {
  const el = document.getElementById('lot-gtin');
  const msg = document.getElementById('lot-gtin-msg');
  if (!el) return;
  const val = el.value.replace(/\D/g, '');
  const base12 = val.slice(0, 12).padStart(12, '0');
  const full = generateGTIN13(base12);
  if (full) {
    el.value = full;
    msg.innerHTML = '✅ GTIN-13: ' + formatGTIN(full);
    msg.style.color = '#2E7D32';
    window.showToast?.('✓ Đã sinh GTIN-13: ' + full, 'ok');
  }
};

window.wire_lots = function() {
  const nav = () => document.querySelector('[x-data]').__x.$data.nav('lots');

  // List view
  document.querySelectorAll('[data-lot]').forEach(el => el.addEventListener('click', () => {
    currentLotId = el.dataset.lot;
    nav();
  }));

  document.getElementById('lot-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      // V4.0 — gói Farmer (trace_basic): tối đa 3 lô đang canh tác. HTX trở lên không giới hạn.
      if (!hasFeature('trace_full')) {
        const active = (await lotStore.list()).filter(l => l.status === 'growing').length;
        if (active >= TRACE_BASIC_MAX_LOTS) {
          throw new Error(`Gói ${PLANS[authStore.plan]?.name || 'Farmer'} tối đa ${TRACE_BASIC_MAX_LOTS} lô đang canh tác. Nâng lên HTX (${PLANS.promax.priceOnce} · ${PLANS.promax.sub}) để không giới hạn lô.`);
        }
      }
      const lot = await lotStore.create({
        crop: fd.get('crop'), variety: fd.get('variety'), zoneId: fd.get('zoneId'),
        area: fd.get('area'), plantedAt: fd.get('plantedAt'), note: fd.get('note'),
        trace: {
          standards: fd.getAll('std'),
          puc: fd.get('puc'), gtin: fd.get('gtin'), gln: fd.get('gln'),
          producer: fd.get('producer'), address: fd.get('address'),
          certNo: fd.get('certNo'), certBody: fd.get('certBody'), certExpiry: fd.get('certExpiry'),
          market: fd.get('market'), seedSource: fd.get('seedSource'),
        }
      });
      window.showToast?.(`✓ Đã tạo lô ${lot.code}`, 'ok');
      currentLotId = lot.id;
      nav();
    } catch (err) { window.showToast?.('✗ ' + err.message, 'err'); }
  });

  // Detail view
  document.getElementById('lot-back')?.addEventListener('click', () => { currentLotId = null; nav(); });

  // Event form — hiện vật tư khi chọn bón phân / BVTV
  const typeSel = document.getElementById('evt-type');
  if (typeSel) {
    const matBox = document.getElementById('evt-material-box');
    const matSel = document.getElementById('evt-material');
    const phiWarn = document.getElementById('evt-phi-warn');
    const refreshMat = async () => {
      const isMat = ['fertilizer', 'pest'].includes(typeSel.value);
      matBox.style.display = isMat ? 'block' : 'none';
      if (isMat) {
        const mats = await materialsStore.list();
        const want = typeSel.value === 'fertilizer' ? 'fertilizer' : 'pesticide';
        matSel.innerHTML = `<option value="">— Chọn vật tư —</option>` +
          mats.filter(m => m.type === want || m.type === 'other').map(m =>
            `<option value="${m.id}">${escapeHtml(m.name)}${m.phiDays > 0 ? ` (PHI ${m.phiDays}d)` : ''}</option>`).join('');
      }
    };
    typeSel.addEventListener('change', refreshMat);
    refreshMat();
    matSel?.addEventListener('change', async () => {
      const m = await materialsStore.byId(matSel.value);
      phiWarn.textContent = m && m.phiDays > 0 ? `⚠ Thuốc này có thời gian cách ly ${m.phiDays} ngày — lô sẽ bị khoá thu hoạch tương ứng.` : '';
    });
  }

  document.getElementById('lot-evt-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const { phiApplied } = await lotStore.recordActivity(currentLotId, {
        type: fd.get('type'), materialId: fd.get('materialId') || null,
        dose: fd.get('dose'), doseUnit: fd.get('doseUnit'), note: fd.get('note')
      });
      window.showToast?.(phiApplied ? `✓ Đã ghi. 🔒 Khoá thu hoạch ${phiApplied.phiDays} ngày (PHI)` : '✓ Đã ghi sự kiện', 'ok');
      nav();
    } catch (err) { window.showToast?.('✗ ' + err.message, 'err'); }
  });

  document.getElementById('lot-harvest-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await lotStore.harvest(currentLotId, {
        qty: fd.get('qty'), unit: fd.get('unit'), date: fd.get('date'),
        overridePhi: !!fd.get('overridePhi')
      });
      window.showToast?.('✓ Đã ghi nhận thu hoạch — QR truy xuất sẵn sàng', 'ok');
      nav();
    } catch (err) {
      const msg = String(err.message || '');
      window.showToast?.(msg.startsWith('PHI_LOCKED:') ? '🔒 ' + msg.slice(11) : '✗ ' + msg, 'err');
    }
  });

  // QR render (sau thu hoạch) — V3.2: nhúng payload trong QR để landing page
  // hiển thị hồ sơ ngay cả khi lô chưa sync cloud
  (async () => {
    const qrEl = document.getElementById('lot-qr');
    if (!qrEl || !currentLotId) return;
    const lot = await lotStore.byId(currentLotId);
    if (!lot) return;
    const events = await lotStore.events(currentLotId);
    const qr = qrcode(0, 'M');
    qr.addData(lotStore.traceUrl(lot, events));
    qr.make();
    qrEl.innerHTML = qr.createSvgTag({ cellSize: 3, margin: 0 });
  })();

  // GTIN auto-check và sinh check digit
  document.getElementById('lot-gtin')?.addEventListener('input', function() {
    const msg = document.getElementById('lot-gtin-msg');
    const val = this.value.replace(/\D/g, '');
    this.value = val;
    if (val.length === 13) {
      if (validateGTIN(val)) { msg.innerHTML = '✅ hợp lệ'; msg.style.color = '#2E7D32'; }
      else { msg.innerHTML = '⚠ sai check digit'; msg.style.color = '#c62828'; }
    } else if (val.length >= 12) {
      const full = generateGTIN13(val.slice(0, 12).padStart(12, '0'));
      msg.innerHTML = full ? `→ <a href="#" onclick="document.getElementById('lot-gtin').value='${full}';document.getElementById('lot-gtin').dispatchEvent(new Event('input'));return false;" style="color:#2E7D32;">${full}</a>` : '';
    } else { msg.innerHTML = ''; }
  });

  // PUC format
  document.querySelector('[name="puc"]')?.addEventListener('input', function() {
    this.value = formatPUC(this.value);
  });

  // Phiếu truy xuất PDF — render canvas (full tiếng Việt) → jsPDF
  document.getElementById('lot-pdf')?.addEventListener('click', async () => {
    try {
      const lot = await lotStore.byId(currentLotId);
      const events = await lotStore.events(currentLotId);
      await exportTracePdf(lot, events);
      window.showToast?.('✓ Đã xuất phiếu truy xuất', 'ok');
    } catch (err) { window.showToast?.('✗ ' + err.message, 'err'); }
  });
};

async function exportTracePdf(lot, events) {
  const { jsPDF } = await import('jspdf');
  const W = 1000;
  const lineH = 34;
  const rows = 14 + 9 + events.length; // +9 cho hồ sơ chuẩn (GS1/VietGAP/EU/Nhật)
  const H = Math.max(1414, 320 + rows * lineH + 320);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);

  // Header
  ctx.fillStyle = '#2E7D32'; ctx.fillRect(0, 0, W, 110);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 40px sans-serif';
  ctx.fillText('PHIẾU TRUY XUẤT NGUỒN GỐC', 40, 68);
  ctx.font = '24px sans-serif';
  ctx.fillText('EcoSynTech Farm OS', W - 300, 68);

  let y = 170;
  const line = (label, val, bold) => {
    ctx.fillStyle = '#555'; ctx.font = '24px sans-serif';
    ctx.fillText(label, 40, y);
    ctx.fillStyle = '#111'; ctx.font = (bold ? 'bold ' : '') + '24px sans-serif';
    ctx.fillText(String(val == null ? '' : val), 320, y);
    y += lineH;
  };
  line('Mã lô', lot.code, true);
  line('Sản phẩm', lot.crop + (lot.variety ? ' — ' + lot.variety : ''), true);
  line('Nông trại / Zone', `${lot.farmId}${lot.zoneId ? ' / ' + lot.zoneId : ''}`);
  line('Diện tích', lot.area || '-');
  line('Ngày xuống giống', lot.plantedAt);
  if (lot.trace) {
    const tr = lot.trace;
    if ((tr.standards || []).length) line('Chuẩn áp dụng', tr.standards.join(', '), true);
    if (tr.puc) line('Mã vùng trồng (PUC)', tr.puc, true);
    if (tr.market) line('Thị trường đích', tr.market);
    if (tr.gtin) line('GTIN (GS1)', tr.gtin);
    if (tr.gln) line('GLN (GS1)', tr.gln);
    if (tr.producer) line('Cơ sở sản xuất', tr.producer + (tr.address ? ' — ' + tr.address : ''));
    if (tr.certNo) line('Chứng nhận GAP', tr.certNo + (tr.certBody ? ' (' + tr.certBody + ')' : '') + (tr.certExpiry ? ' · HSD ' + tr.certExpiry : ''));
    if (tr.seedSource) line('Nguồn giống', tr.seedSource);
  }
  if (lot.harvest) {
    line('Ngày thu hoạch', lot.harvest.date, true);
    line('Sản lượng', `${lot.harvest.qty} ${lot.harvest.unit}`, true);
    if (lot.harvest.phiOverridden) line('⚠ Cảnh báo', 'Thu hoạch khi còn thời gian cách ly (override)', true);
  }
  line('Link truy xuất', lotStore.traceUrl(lot));

  // QR
  const qr = qrcode(0, 'M');
  qr.addData(lotStore.traceUrl(lot));
  qr.make();
  const n = qr.getModuleCount();
  const cell = Math.floor(220 / n);
  const qx = W - 40 - n * cell, qy = 150;
  ctx.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(qx + c * cell, qy + r * cell, cell, cell);

  // GS1-128 barcode
  const gtin = lot.trace?.gtin || '';
  const lotCode = lot.code || '';
  if (gtin) {
    const gs1Raw = formatGS1AIString(gtin, lotCode, '');
    const gs1Human = formatGS1AIHuman(gtin, lotCode, '');
    const barcodePats = encodeGS1128Barcode(gs1Raw);
    if (barcodePats) {
      const bx = 40, by = qy + n * cell + 30;
      // Nhãn "GS1-128"
      ctx.fillStyle = '#555'; ctx.font = '16px sans-serif';
      ctx.fillText('GS1-128:', bx, by - 6);
      drawGS1128(ctx, bx + 100, by, barcodePats, 50, 1.0);
      // Human-readable dưới barcode
      ctx.fillStyle = '#333'; ctx.font = '12px monospace';
      let hy = by + 55;
      for (const line of gs1Human.split('\n')) {
        ctx.fillText(line, bx + 100, hy);
        hy += 16;
      }
    }
  }

  // Timeline
  y += 20;
  ctx.fillStyle = '#2E7D32'; ctx.font = 'bold 28px sans-serif';
  ctx.fillText(`NHẬT KÝ CANH TÁC (${events.length} sự kiện)`, 40, y);
  y += 14; ctx.strokeStyle = '#ccc'; ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(W - 40, y); ctx.stroke();
  y += lineH;
  const LBL = {
    planting: 'Xuống giống', irrigation: 'Tưới nước', fertilizer: 'Bón phân',
    pest: 'Xử lý BVTV', weeding: 'Chăm sóc', inspection: 'Kiểm tra', harvest: 'Thu hoạch', other: 'Khác'
  };
  for (const e of events) {
    ctx.fillStyle = '#555'; ctx.font = '20px sans-serif';
    ctx.fillText(new Date(e.ts).toLocaleString('vi-VN'), 40, y);
    ctx.fillStyle = '#111'; ctx.font = 'bold 22px sans-serif';
    ctx.fillText(LBL[e.type] || e.type, 300, y);
    ctx.font = '20px sans-serif';
    const detail = [e.materialName, e.dose ? `${e.dose} ${e.doseUnit || ''}` : null, e.note].filter(Boolean).join(' · ');
    ctx.fillText(detail.slice(0, 55), 470, y);
    y += lineH;
  }

  // Footer
  y = Math.max(y + 30, H - 100);
  ctx.fillStyle = '#888'; ctx.font = '18px sans-serif';
  ctx.fillText(`Phát hành: ${new Date().toLocaleString('vi-VN')} · Hồ sơ append-only từ EcoSynTech Farm OS — không chỉnh sửa được sau khi ghi.`, 40, y);

  const img = cv.toDataURL('image/jpeg', 0.92);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = 210, ph = (H / W) * pw;
  if (ph <= 297) {
    pdf.addImage(img, 'JPEG', 0, 0, pw, ph);
  } else {
    // cắt trang
    const pageHpx = Math.floor(W * (297 / 210));
    let offset = 0, first = true;
    while (offset < H) {
      const slice = document.createElement('canvas');
      slice.width = W; slice.height = Math.min(pageHpx, H - offset);
      slice.getContext('2d').drawImage(cv, 0, offset, W, slice.height, 0, 0, W, slice.height);
      if (!first) pdf.addPage();
      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pw, (slice.height / W) * pw);
      offset += pageHpx; first = false;
    }
  }
  pdf.save(`phieu-truy-xuat-${lot.code}.pdf`);
}
