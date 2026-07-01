import { blockchainStore } from '../stores/blockchain.js';
import { authStore } from '../stores/auth.js';
import { lotStore as lotsStore } from '../db/trace.js';
import { logisticsStore, CARRIER_LIST } from '../stores/logistics.js';
import qrcode from 'qrcode-generator';

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

export async function renderBlockchain() {
  const summary = await blockchainStore.getSummary();
  const pendingSync = await blockchainStore.getPendingSync();

  const lots = await lotsStore.list().catch(() => []);

  return `
    <div class="app-header">⛓ Blockchain Trace
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('more')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>

    <div style="display:flex;gap:6px;padding:10px 16px;flex-wrap:wrap;">
      <div class="card" style="flex:1;padding:8px;text-align:center;border-color:#0288D1;">
        <div style="font-size:20px;font-weight:800;color:#0288D1;">${summary.totalTx}</div>
        <div style="font-size:10px;color:var(--c-text-muted);">Giao dịch</div>
      </div>
      <div class="card" style="flex:1;padding:8px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:#2E7D32;">${summary.uniqueBatches}</div>
        <div style="font-size:10px;color:var(--c-text-muted);">Lô đã ghi</div>
      </div>
      <div class="card" style="flex:1;padding:8px;text-align:center;">
        <div style="font-size:20px;font-weight:800;">${pendingSync.length}</div>
        <div style="font-size:10px;color:var(--c-text-muted);">Chờ đồng bộ</div>
      </div>
      <div class="card" style="flex:1;padding:8px;text-align:center;">
        <div style="font-size:12px;font-weight:600;">Aptos testnet</div>
        <div style="font-size:10px;color:var(--c-text-muted);">chain ${summary.lastTx?.chainId || 2}</div>
      </div>
    </div>

    ${Object.keys(summary.byType).length ? `
    <div style="padding:0 16px 8px;">
      <div class="card" style="padding:10px;">
        <div style="font-size:12px;font-weight:600;margin-bottom:4px;">📊 Giao dịch theo loại</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;">
          ${Object.entries(summary.byType).map(([type, count]) => {
            const icons = { batch_create: '📦', stage_: '📋', harvest: '🌾', export: '🚢', certification: '📜' };
            const icon = Object.entries(icons).find(([k]) => type.startsWith(k))?.[1] || '⛓';
            return `<span style="background:#E3F2FD;padding:3px 8px;border-radius:4px;font-size:11px;">${icon} ${type}: ${count}</span>`;
          }).join('')}
        </div>
      </div>
    </div>` : ''}

    <div style="padding:0 16px 8px;">
      <button class="btn primary" style="width:100%;font-size:13px;" onclick="window.bcShowForm()">➕ Ghi lô lên Aptos</button>
    </div>

    <div id="bc-add-form" style="display:none;padding:12px;margin:0 16px 8px;border:2px solid #0288D1;border-radius:10px;">
      <div style="font-weight:700;margin-bottom:6px;">⛓ Ghi dữ liệu lên Aptos Blockchain</div>
      <select id="bc-lot-select" class="form">
        <option value="">-- Chọn lô --</option>
        ${lots.map(l => `<option value="${esc(l.id || l.lotId)}">${esc(l.name || l.crop || l.id || l.lotId)}</option>`).join('')}
      </select>
      <div style="display:flex;gap:4px;">
        <input id="bc-gtin" class="form" placeholder="Mã GTIN (GS1, 13 số)" style="flex:2;" />
        <button class="btn small" style="font-size:10px;" onclick="window.bcValidateGTIN()">✓ Check</button>
      </div>
      <div id="bc-gtin-valid" style="font-size:11px;margin:2px 0 4px;"></div>
      <input id="bc-product" class="form" placeholder="Tên sản phẩm *" />
      <input id="bc-crop" class="form" placeholder="Cây trồng" />
      <div style="display:flex;gap:4px;">
        <input id="bc-qty" class="form" type="number" placeholder="Số lượng" style="flex:1;" />
        <input id="bc-unit" class="form" placeholder="ĐVT" style="width:60px;" value="kg" />
      </div>
      <button class="btn primary" style="width:100%;margin-top:6px;background:#0288D1;" onclick="window.bcRecordBatch()">⛓ Ghi lên Aptos</button>
      <button class="btn secondary" style="width:100%;margin-top:4px;" onclick="document.getElementById('bc-add-form').style.display='none'">Hủy</button>
    </div>

    <h3 style="padding:8px 16px 2px;font-size:13px;color:var(--c-text-muted);text-transform:uppercase;">Giao dịch gần đây</h3>
    <div id="bc-tx-list">
      ${await renderTxList()}
    </div>

    <h3 style="padding:8px 16px 2px;margin-top:4px;font-size:13px;color:var(--c-text-muted);text-transform:uppercase;">🔗 GS1 Digital Link QR (Vietnam/EU)</h3>
    <div class="card" style="padding:12px;margin:8px 16px;">
      <div style="font-weight:600;margin-bottom:6px;">Tạo QR GS1 cho sản phẩm</div>
      <div style="display:flex;gap:4px;">
        <input id="bc-qr-gtin" class="form" placeholder="GTIN-13 (nhập 12 số + tự sinh check digit)" style="flex:1;" />
        <button class="btn small" style="font-size:10px;" onclick="window.bcAutoGTIN()">Tự GTIN</button>
      </div>
      <div id="bc-gtin-full" style="font-size:11px;margin:2px 0 4px;"></div>
      <div style="display:flex;gap:4px;">
        <input id="bc-qr-batch" class="form" placeholder="Batch/lô (VD: LOTA001)" style="flex:1;" />
        <input id="bc-qr-serial" class="form" placeholder="Serial (tự động)" style="flex:1;" />
      </div>
      <div style="display:flex;gap:4px;margin-top:6px;">
        <button class="btn primary" style="flex:1;" onclick="window.bcGenerateQR()">📱 Tạo QR</button>
        <button class="btn secondary" style="flex:1;" onclick="window.bcGenerateEPCIS()">📄 EPCIS event</button>
      </div>
      <div id="bc-qr-result" style="margin-top:8px;"></div>
    </div>

    ${pendingSync.length ? `
    <h3 style="padding:8px 16px 2px;font-size:13px;color:var(--c-text-muted);text-transform:uppercase;">📤 Chờ đồng bộ quốc gia</h3>
    <div style="padding:0 16px 16px;">
      ${pendingSync.map(p => `<div class="card" style="padding:8px;font-size:12px;">
        ${p.batchId} · ${p.txCount} tx · ${new Date(p.exportedAt).toLocaleString('vi-VN')}
      </div>`).join('')}
    </div>` : ''}

    <div style="text-align:center;padding:16px;font-size:11px;color:var(--c-text-muted);">
      Aptos ${blockchainStore.getNetworkName()} · ${esc(authStore.farmerId || 'local')} · Hash: SHA-256
    </div>
  `;
}

async function renderTxList() {
  const txs = await blockchainStore.getTransactions(null, 20);
  if (!txs.length) {
    return '<div class="empty" style="padding:20px;"><div class="ico">⛓</div><p>Chưa có giao dịch nào. Ghi lô lên Aptos để bắt đầu.</p></div>';
  }
  return txs.map(tx => {
    const iconMap = {
      batch_create: '📦',
      harvest: '🌾',
      export: '🚢',
      certification: '📜'
    };
    const icon = Object.entries(iconMap).find(([k]) => tx.type.startsWith(k))?.[1] || Object.entries({ stage_: '📋' }).find(([k]) => tx.type.startsWith(k))?.[1] || '⛓';
    const shortHash = tx.hash ? tx.hash.slice(0, 14) + '...' : 'N/A';
    return `<div class="card" style="padding:10px;">
      <div class="row">
        <div>
          <span style="font-weight:600;">${icon} ${esc(tx.type)}</span>
          <span style="font-size:11px;color:var(--c-text-muted);margin-left:4px;">v.${tx.version?.slice(-6) || ''}</span>
        </div>
        <span style="font-size:10px;color:#0288D1;font-family:monospace;">${shortHash}</span>
      </div>
      <div style="font-size:11px;color:var(--c-text-muted);">
        ${tx.date} · ${esc(tx.payload?.batchId || tx.payload?.productName || '')}
        ${tx.payload?.grade ? '· ' + esc(tx.payload.grade) : ''}
        ${tx.payload?.quantity ? '· ' + tx.payload.quantity : ''}
      </div>
      <div style="display:flex;gap:4px;margin-top:4px;">
        <button class="btn small" onclick="window.bcVerify('${tx.payload?.batchId || ''}','${tx.dataHash || ''}')" style="font-size:10px;">🔍 Verify</button>
        <button class="btn small" onclick="window.bcExplorer('${tx.hash}')" style="font-size:10px;">🌐 Explorer</button>
      </div>
    </div>`;
  }).join('');
}

window.bcShowForm = () => { document.getElementById('bc-add-form').style.display = 'block'; };

window.bcRecordBatch = async () => {
  const batchId = document.getElementById('bc-lot-select')?.value || 'LOT_' + Date.now().toString(36);
  const product = document.getElementById('bc-product')?.value.trim();
  if (!product) { window.showToast?.('Nhập tên sản phẩm', 'err'); return; }
  const tx = await blockchainStore.recordBatch({
    batchId,
    gtin: document.getElementById('bc-gtin')?.value || '',
    productName: product,
    crop: document.getElementById('bc-crop')?.value || '',
    zoneId: '',
    quantity: document.getElementById('bc-qty')?.value || 0,
    unit: document.getElementById('bc-unit')?.value || 'kg'
  });
  if (tx) {
    window.showToast?.('✅ Đã ghi lên Aptos — Tx ' + tx.hash?.slice(0, 10) + '...', 'ok');
    document.querySelector('[x-data]').__x?.$data?.nav?.('blockchain');
  }
};

window.bcGenerateQR = async () => {
  const gtin = document.getElementById('bc-qr-gtin')?.value.trim();
  const batch = document.getElementById('bc-qr-batch')?.value.trim();
  if (!gtin || !batch) { window.showToast?.('Nhập GTIN và Batch', 'err'); return; }
  const serial = document.getElementById('bc-qr-serial')?.value.trim() || batch + '_' + Date.now().toString(36);
  const gs1Data = blockchainStore.generateGS1QRData(gtin, batch, serial);
  const digitalLink = blockchainStore.generateGS1DigitalLink({ gtin, batch, serial });
  const container = document.getElementById('bc-qr-result');

  // Try to generate QR code using qrcode library if available
  let qrSvg = '';
  try {
    const QRCode = window.QRCode;
    if (QRCode) {
      qrSvg = QRCode.toString(digitalLink, { type: 'svg', errorCorrectionLevel: 'H' });
    }
    if (!qrSvg) {
      const qr = qrcode?.(0, 'M');
      if (qr) { qr.addData(digitalLink); qr.make(); qrSvg = qr.createSvgTag({ cellSize: 3, margin: 0 }); }
    }
  } catch (_) {}

  const gtinValid = blockchainStore.checkGTIN(gtin);
  const gtinFormatted = gtinValid ? `✅ GTIN-13 hợp lệ` : `⚠ GTIN cần kiểm tra`;

  container.innerHTML = `
    <div class="card" style="padding:10px;border-color:#0288D1;">
      <div style="font-weight:600;">📱 GS1 Digital Link QR — ${gtinFormatted}</div>
      ${qrSvg ? `<div style="text-align:center;margin:8px 0;">${qrSvg}</div>` : `<div style="background:#f5f5f5;padding:20px;text-align:center;font-family:monospace;font-size:11px;word-break:break-all;">${esc(digitalLink)}</div>`}
      <div style="font-size:11px;margin-top:4px;background:#f5f5f5;padding:6px 8px;border-radius:4px;">
        <strong>GS1 AI:</strong> <code style="font-size:10px;word-break:break-all;">${esc(gs1Data)}</code>
      </div>
      <div style="font-size:11px;font-family:monospace;margin-top:2px;word-break:break-all;">
        🔗 <a href="${esc(digitalLink)}" target="_blank">${esc(digitalLink)}</a>
      </div>
      <div style="font-size:11px;margin-top:2px;color:var(--c-text-muted);">
        📦 <strong>GTIN:</strong> ${esc(gtin)} · <strong>Batch:</strong> ${esc(batch || '-')} · <strong>Serial:</strong> ${esc(serial.slice(-8))}
      </div>
      <div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap;">
        <button class="btn small" style="font-size:10px;" onclick="navigator.clipboard.writeText('${esc(digitalLink)}').then(()=>window.showToast?.('Đã copy link','ok'))">📋 Copy DL</button>
        <button class="btn small" style="font-size:10px;" onclick="navigator.clipboard.writeText('${esc(gs1Data)}').then(()=>window.showToast?.('Đã copy GS1','ok'))">📋 Copy GS1 AI</button>
        <button class="btn small" style="font-size:10px;" onclick="window.bcVerifyBatch('${esc(batch)}')">🔍 Verify chain</button>
      </div>
    </div>
  `;
};

window.bcVerify = async (batchId, hash) => {
  if (!batchId) { window.showToast?.('Không có batchId', ''); return; }
  const result = await blockchainStore.verifyHash(batchId, hash);
  if (result.verified) {
    window.showToast?.(`✅ Verified — ${result.txCount} tx trên chain`, 'ok');
  } else {
    window.showToast?.('⚠ Không tìm thấy hash trên chain', '');
  }
};

window.bcVerifyBatch = async (batchId) => {
  if (!batchId) { window.showToast?.('Nhập batch', 'err'); return; }
  const integrity = await blockchainStore.verifyBatchIntegrity(batchId);
  if (integrity.verified) {
    window.showToast?.(`✅ Chain integrity OK — ${integrity.txCount} transactions`, 'ok');
  } else {
    window.showToast?.(`⚠ Missing: ${integrity.missingTypes?.join(', ') || 'unknown'}`, '');
  }
};

window.bcExplorer = (hash) => {
  if (!hash) return;
  const url = blockchainStore.getExplorerUrl(hash, 'testnet');
  if (url) window.open(url, '_system');
};

window.bcRefresh = () => {
  document.querySelector('[x-data]').__x?.$data?.nav?.('blockchain');
};

window.bcValidateGTIN = () => {
  const gtin = document.getElementById('bc-gtin')?.value.trim();
  const el = document.getElementById('bc-gtin-valid');
  if (!gtin || gtin.length < 12) { el.innerHTML = ''; return; }
  if (blockchainStore.checkGTIN(gtin)) {
    el.innerHTML = '✅ GTIN hợp lệ';
    el.style.color = '#2E7D32';
  } else {
    const full = blockchainStore.makeGTIN13(gtin.slice(0, 12).padStart(12, '0'));
    el.innerHTML = full ? `⚠ GTIN sai check digit — ý bạn là <strong>${full}</strong>? <a href="#" onclick="document.getElementById('bc-gtin').value='${full}';window.bcValidateGTIN();return false;">Dùng</a>` : '❌ GTIN không hợp lệ';
    el.style.color = '#c62828';
  }
};

window.bcAutoGTIN = () => {
  const gtin = document.getElementById('bc-qr-gtin')?.value.trim();
  const el = document.getElementById('bc-gtin-full');
  if (!gtin || gtin.length < 12) { el.innerHTML = 'Nhập 12 số đầu để sinh GTIN-13'; el.style.color = 'var(--c-text-muted)'; return; }
  const base = gtin.replace(/\D/g, '').slice(0, 12).padStart(12, '0');
  const full = blockchainStore.makeGTIN13(base);
  if (full) {
    document.getElementById('bc-qr-gtin').value = full;
    el.innerHTML = `✅ GTIN-13: <strong>${full}</strong> (check digit: ${full.slice(-1)})`;
    el.style.color = '#2E7D32';
  } else {
    el.innerHTML = '❌ Không thể sinh GTIN';
    el.style.color = '#c62828';
  }
};

window.bcGenerateEPCIS = async () => {
  const gtin = document.getElementById('bc-qr-gtin')?.value.trim();
  const batch = document.getElementById('bc-qr-batch')?.value.trim();
  if (!gtin) { window.showToast?.('Nhập GTIN trước', 'err'); return; }
  const event = blockchainStore.generateEPCISEvent({
    type: 'harvesting',
    gtin, lot: batch || 'LOT' + Date.now().toString(36).toUpperCase(),
    bizStep: 'harvesting',
    quantity: 1, unit: 'KGM',
    location: authStore.activeFarmId || 'VN',
    action: 'OBSERVE'
  });
  await blockchainStore.saveEPCISEvent(event);
  const container = document.getElementById('bc-qr-result');
  const json = JSON.stringify(event, null, 2);
  container.innerHTML = `
    <div class="card" style="padding:10px;border-color:#6A1B9A;">
      <div style="font-weight:600;">📄 EPCIS Event (EU export)</div>
      <pre style="font-size:9px;background:#f5f5f5;padding:8px;border-radius:4px;overflow-x:auto;margin-top:6px;max-height:200px;word-break:break-all;">${esc(json)}</pre>
      <button class="btn small" style="margin-top:4px;font-size:10px;" onclick="navigator.clipboard.writeText(\`${esc(json)}\`).then(()=>window.showToast?.('Đã copy EPCIS','ok'))">📋 Copy EPCIS</button>
    </div>
  `;
  window.showToast?.('✓ Đã tạo EPCIS event — sẵn sàng cho EU export', 'ok');
};

window.wire_blockchain = function () {};
