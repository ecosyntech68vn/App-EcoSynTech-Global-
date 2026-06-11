// Feature G — QR scan device link
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { fallbackFetch } from '../api/fallback-client.js';

export async function renderScan() {
  return `
    <div class="app-header">📷 QR Scan thiết bị
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('dashboard')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>
    <div class="empty">
      <div class="ico">📷</div>
      <p>Quét QR code dán trên thiết bị để xem thông tin + gửi lệnh nhanh.</p>
    </div>
    <div class="form">
      <button id="start-scan" class="btn">📷 Bắt đầu quét</button>
      <div id="scan-result" style="margin-top:20px;"></div>
    </div>
  `;
}

window.wire_scan = function() {
  document.getElementById('start-scan')?.addEventListener('click', async () => {
    const btn = document.getElementById('start-scan');
    btn.disabled = true; btn.textContent = 'Đang quét...';
    try {
      const perm = await BarcodeScanner.checkPermission({ force: true });
      if (!perm.granted) {
        window.showToast && window.showToast('Cần cấp quyền camera', 'err');
        btn.disabled = false; btn.textContent = '📷 Bắt đầu quét';
        return;
      }
      document.body.style.background = 'transparent';
      await BarcodeScanner.hideBackground();
      const result = await BarcodeScanner.startScan();
      document.body.style.background = '';
      if (result.hasContent) {
        await showDeviceInfo(result.content);
      }
    } catch (e) {
      window.showToast && window.showToast('Quét thất bại: ' + e.message, 'err');
    }
    btn.disabled = false; btn.textContent = '📷 Bắt đầu quét';
  });
};

async function showDeviceInfo(qrContent) {
  const resultEl = document.getElementById('scan-result');
  // Parse content: expected `device:<id>` or full URL
  let deviceId = qrContent;
  const m = qrContent.match(/device[:/]([a-zA-Z0-9_-]+)/);
  if (m) deviceId = m[1];

  resultEl.innerHTML = '<div class="card"><div class="card-meta">Đang tải...</div></div>';
  try {
    const r = await fallbackFetch(`/api/devices/${deviceId}`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    resultEl.innerHTML = `
      <div class="card ok">
        <div class="card-title">${escapeHtml(d.name || deviceId)}</div>
        <div class="card-meta">ID: ${escapeHtml(deviceId)}</div>
        <div class="card-meta">Loại: ${escapeHtml(d.type || '-')}</div>
        <div class="card-meta">Zone: ${escapeHtml(d.zoneId || '-')}</div>
        <div class="card-meta">Status: ${escapeHtml(d.status || '-')}</div>
        <div style="margin-top:10px;">
          <button class="btn secondary" onclick="document.querySelector('[x-data]').__x.$data.nav('control')">→ Điều khiển</button>
        </div>
      </div>`;
  } catch (e) {
    resultEl.innerHTML = `<div class="card crit"><div class="card-title">QR: ${escapeHtml(qrContent)}</div><div class="card-meta">Không tìm thấy thiết bị (${e.message})</div></div>`;
  }
}
function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
