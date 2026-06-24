import { logisticsStore, CARRIER_LIST } from '../stores/logistics.js';
import { contractStore } from '../stores/contract.js';

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function vnd(n) { return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0); }

function statusBadge(status) {
  const map = {
    pending: { label: 'Chờ', color: '#999', bg: '#f5f5f5' },
    created: { label: 'Đã tạo', color: '#1565C0', bg: '#E3F2FD' },
    in_transit: { label: 'Đang VC', color: '#F57F17', bg: '#FFF8E1' },
    delivered: { label: 'Đã giao', color: '#2E7D32', bg: '#E8F5E9' },
    failed: { label: 'Thất bại', color: '#c62828', bg: '#FFEBEE' }
  };
  const s = map[status] || map.pending;
  return `<span style="background:${s.bg};color:${s.color};padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;">${s.label}</span>`;
}

export async function renderLogistics() {
  const shipments = await logisticsStore.getAll();
  const summary = await logisticsStore.getSummary();
  const contracts = await contractStore.getAll();
  const activeContracts = contracts.filter(c => c.status === 'active');

  return `
    <div class="app-header">🚚 Vận chuyển
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('more')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>

    <div style="display:flex;gap:6px;padding:10px 16px;flex-wrap:wrap;">
      <div class="card" style="flex:1;padding:8px;text-align:center;">
        <div style="font-size:20px;font-weight:800;">${summary.total}</div>
        <div style="font-size:10px;color:var(--c-text-muted);">Tổng vận đơn</div>
      </div>
      <div class="card" style="flex:1;padding:8px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:#2E7D32;">${summary.delivered}</div>
        <div style="font-size:10px;color:var(--c-text-muted);">Đã giao</div>
      </div>
      <div class="card" style="flex:1;padding:8px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:#F57F17;">${summary.inTransit}</div>
        <div style="font-size:10px;color:var(--c-text-muted);">Đang VC</div>
      </div>
      <div class="card" style="flex:1;padding:8px;text-align:center;">
        <div style="font-size:14px;font-weight:800;">${vnd(summary.totalCod)}</div>
        <div style="font-size:10px;color:var(--c-text-muted);">COD</div>
      </div>
    </div>

    <div style="padding:0 16px 8px;">
      <button class="btn primary" style="width:100%;font-size:13px;" onclick="window.logShowForm()">➕ Tạo vận đơn</button>
    </div>

    <div id="log-add-form" style="display:none;padding:12px;margin:0 16px 8px;border:2px solid #1565C0;border-radius:10px;">
      <div style="font-weight:700;margin-bottom:6px;">🚚 Tạo vận đơn mới</div>
      <select id="log-carrier" class="form">
        ${CARRIER_LIST.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
      </select>
      <select id="log-contract" class="form">
        <option value="">-- Không gắn hợp đồng --</option>
        ${activeContracts.map(c => `<option value="${c.id}">${esc(c.partnerName)} — ${esc(c.crop || '')}</option>`).join('')}
      </select>
      <input id="log-batch" class="form" placeholder="Mã lô hàng" />
      <div style="font-weight:600;font-size:12px;margin:4px 0;">👤 Người gửi</div>
      <div style="display:flex;gap:4px;">
        <input id="log-sender-name" class="form" placeholder="Tên" style="flex:1;" />
        <input id="log-sender-phone" class="form" type="tel" placeholder="SĐT" style="flex:1;" />
      </div>
      <input id="log-sender-addr" class="form" placeholder="Địa chỉ" />
      <div style="font-weight:600;font-size:12px;margin:4px 0;">👤 Người nhận</div>
      <div style="display:flex;gap:4px;">
        <input id="log-rec-name" class="form" placeholder="Tên *" style="flex:1;" />
        <input id="log-rec-phone" class="form" type="tel" placeholder="SĐT" style="flex:1;" />
      </div>
      <input id="log-rec-addr" class="form" placeholder="Địa chỉ *" />
      <div style="display:flex;gap:4px;">
        <input id="log-weight" class="form" type="number" placeholder="Kg" style="flex:1;" />
        <input id="log-cod" class="form" type="number" placeholder="COD (VNĐ)" style="flex:1;" />
      </div>
      <textarea id="log-notes" class="form" placeholder="Ghi chú" rows="2"></textarea>
      <button class="btn primary" style="width:100%;margin-top:6px;" onclick="window.logCreate()">💾 Tạo vận đơn</button>
      <button class="btn secondary" style="width:100%;margin-top:4px;" onclick="document.getElementById('log-add-form').style.display='none'">Hủy</button>
    </div>

    <h3 style="padding:8px 16px 2px;font-size:13px;color:var(--c-text-muted);text-transform:uppercase;">Danh sách vận đơn</h3>
    ${shipments.length === 0
      ? '<div class="empty" style="padding:20px;"><div class="ico">🚚</div><p>Chưa có vận đơn nào.</p></div>'
      : shipments.slice(0, 30).map(s => {
          const carrier = CARRIER_LIST.find(c => c.id === s.carrierId);
          return `<div class="card" style="padding:10px;">
            <div class="row">
              <div>
                <span style="font-weight:600;">${carrier ? esc(carrier.name) : '?'}</span>
                ${statusBadge(s.status)}
              </div>
              <span style="font-size:11px;color:var(--c-text-muted);">${s.date}</span>
            </div>
            <div style="font-size:12px;margin-top:4px;">
              📤 ${esc(s.receiverName)} ${s.receiverPhone ? '· ' + esc(s.receiverPhone) : ''}
            </div>
            ${s.trackingCode ? `<div style="font-size:11px;color:#1565C0;">
              📦 <a href="${esc(s.trackingUrl)}" target="_blank">${esc(s.trackingCode)}</a>
              <button class="btn small" onclick="window.logTrack('${s.id}')" style="font-size:9px;">📍 Tra cứu</button>
            </div>` : `
            <div style="display:flex;gap:4px;margin-top:4px;">
              <input id="log-tc-${s.id}" class="form" placeholder="Nhập mã vận đơn" style="flex:1;font-size:11px;" />
              <button class="btn small" onclick="window.logSetTracking('${s.id}')" style="font-size:10px;">Lưu</button>
            </div>`}
            ${s.notes ? `<div style="font-size:11px;color:var(--c-text-muted);margin-top:2px;">📝 ${esc(s.notes)}</div>` : ''}
            <div id="log-track-result-${s.id}" style="margin-top:4px;"></div>
          </div>`;
        }).join('')}
  `;
}

window.logShowForm = () => { document.getElementById('log-add-form').style.display = 'block'; };

window.logCreate = async () => {
  const recName = document.getElementById('log-rec-name')?.value.trim();
  const recAddr = document.getElementById('log-rec-addr')?.value.trim();
  if (!recName || !recAddr) { window.showToast?.('Nhập tên và địa chỉ người nhận', 'err'); return; }
  const shipment = await logisticsStore.createShipment({
    carrierId: document.getElementById('log-carrier')?.value || 'vnpost',
    contractId: document.getElementById('log-contract')?.value || '',
    batchId: document.getElementById('log-batch')?.value || '',
    senderName: document.getElementById('log-sender-name')?.value || '',
    senderPhone: document.getElementById('log-sender-phone')?.value || '',
    senderAddr: document.getElementById('log-sender-addr')?.value || '',
    receiverName: recName,
    receiverPhone: document.getElementById('log-rec-phone')?.value || '',
    receiverAddr: recAddr,
    weight: document.getElementById('log-weight')?.value || 0,
    cod: document.getElementById('log-cod')?.value || 0,
    notes: document.getElementById('log-notes')?.value || ''
  });
  if (shipment) {
    window.showToast?.('✅ Đã tạo vận đơn', 'ok');
    document.querySelector('[x-data]').__x?.$data?.nav?.('logistics');
  }
};

window.logSetTracking = async (id) => {
  const code = document.getElementById('log-tc-' + id)?.value.trim();
  if (!code) { window.showToast?.('Nhập mã vận đơn', 'err'); return; }
  await logisticsStore.updateTracking(id, code);
  window.showToast?.('✅ Đã lưu mã tracking', 'ok');
  document.querySelector('[x-data]').__x?.$data?.nav?.('logistics');
};

window.logTrack = async (id) => {
  const shipment = await logisticsStore.getById(id);
  if (!shipment?.trackingCode) { window.showToast?.('Chưa có mã vận đơn', ''); return; }
  const result = await logisticsStore.lookupTracking(shipment.trackingCode, shipment.carrierId);
  const container = document.getElementById('log-track-result-' + id);
  if (!result) { container.innerHTML = '<div class="card-meta">Không tra được.</div>'; return; }
  container.innerHTML = `
    <div class="card" style="padding:8px;margin-top:4px;border-color:#1565C0;font-size:12px;">
      <div style="font-weight:600;">📍 ${esc(result.carrier)}</div>
      ${result.events.map(e => `<div style="display:flex;gap:6px;padding:2px 0;">
        <span>${e.icon}</span>
        <span>${esc(e.label)}</span>
        <span style="color:var(--c-text-muted);font-size:11px;">${new Date(e.timestamp).toLocaleString('vi-VN')}</span>
      </div>`).join('')}
      ${result.estimatedDelivery ? `<div style="margin-top:4px;font-size:11px;color:var(--c-text-muted);">Dự kiến: ${result.estimatedDelivery}</div>` : ''}
    </div>
  `;
};

window.wire_logistics = function () {};
