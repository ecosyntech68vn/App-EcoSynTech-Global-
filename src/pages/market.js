import { lotStore } from '../db/trace.js';
import { orderStore } from '../stores/order.js';
import qrcode from 'qrcode-generator';

function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function fmtMoney(v) { return (v || 0).toLocaleString('vi-VN') + '₫'; }

export async function renderMarket() {
  const lots = await lotStore.list().catch(() => []);
  const harvestLots = lots.filter(l => l.harvest && l.status === 'harvested' && l.harvest.qty > 0);
  const orders = await orderStore.list().catch(() => []);
  const activeOrders = orders.filter(o => o.status !== 'cancelled' && o.status !== 'delivered');

  return `
    <div class="app-header">🛍️ CHợ HTX Online
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('more')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>

    <div class="card ok" style="text-align:center;">
      <div style="font-size:32px;">🏪</div>
      <div style="font-weight:700;">HTX Online Marketplace</div>
      <div class="card-meta">Mỗi sản phẩm có QR truy xuất tích hợp — khách hàng quét là thấy ngay nguồn gốc</div>
    </div>

    <h3 style="padding:14px 16px 4px; color:var(--c-text-muted); font-size:13px; text-transform:uppercase;">Sản phẩm đang bán (${harvestLots.length})</h3>
    ${harvestLots.length === 0 ? `<div class="empty"><p>Chưa có sản phẩm nào. Cần thu hoạch lô trước.</p></div>` : ''}
    ${harvestLots.map(l => `
      <div class="card">
        <div class="row">
          <div class="card-title">${escapeHtml(l.crop)}${l.variety ? ' · ' + escapeHtml(l.variety) : ''}</div>
          ${l.phibadge ? `<span class="pill completed">🏅 PHI Clean</span>` : l.harvest?.phiOverridden ? `<span class="pill" style="background:#c62828;">⚠ PHI Override</span>` : `<span class="pill completed">✅ An toàn</span>`}
        </div>
        <div class="card-meta">Mã lô: ${escapeHtml(l.code)} · ${escapeHtml(l.harvest.date)} · SL: <strong>${escapeHtml(String(l.harvest.qty))} ${escapeHtml(l.harvest.unit || 'kg')}</strong></div>
        <div class="card-meta">${escapeHtml(l.trace?.address || '')}${l.trace?.producer ? ' — ' + escapeHtml(l.trace.producer) : ''}</div>
        <div style="display:flex; gap:8px; margin-top:8px;">
          <button class="btn small" onclick="window.viewTrace('${l.id}')" style="font-size:11px;">🔍 Truy xuất</button>
          <button class="btn small" onclick="window.viewMarketQR('${l.id}')" style="font-size:11px;">📱 QR sản phẩm</button>
          <button class="btn small" onclick="window.quickOrder('${l.id}')" style="font-size:11px;">🛒 Đặt mua ngay</button>
        </div>
        <div id="market-qr-${l.id}" style="display:none; margin-top:8px; text-align:center;"></div>
      </div>`).join('')}

    <h3 style="padding:14px 16px 4px; color:var(--c-text-muted); font-size:13px; text-transform:uppercase;">Đơn hàng gần đây (${activeOrders.length})</h3>
    ${activeOrders.slice(0, 10).map(o => `
      <div class="card">
        <div class="row">
          <div class="card-title">${escapeHtml(o.code)}</div>
          <span class="pill" style="background:${o.status === 'confirmed' ? '#2E7D32' : '#FF8F00'};">${o.status === 'confirmed' ? '✅ Xác nhận' : '⏳ Chờ'}</span>
        </div>
        <div class="card-meta">${escapeHtml(o.customer.name || '')} · ${fmtMoney(o.totalAmount)}</div>
        <div class="card-meta">${o.items.map(i => escapeHtml(i.name || '') + ' x' + escapeHtml(String(i.qty))).join(', ')}</div>
      </div>`).join('') || '<div class="empty"><p>Chưa có đơn hàng.</p></div>'}

    <div class="card" style="margin-top:16px;">
      <div class="card-title">🛒 Tạo đơn hàng nhanh từ sản phẩm</div>
      <form id="market-order-form">
        <label>Chọn sản phẩm</label>
        <select name="lotId" required>
          <option value="">— Chọn —</option>
          ${harvestLots.map(l => `<option value="${l.id}">${escapeHtml(l.code)} · ${escapeHtml(l.crop)} (${l.harvest.qty} ${l.harvest.unit || 'kg'})</option>`).join('')}
        </select>
        <label>Số lượng</label>
        <div style="display:flex;gap:8px;">
          <input name="qty" type="number" inputmode="decimal" step="0.1" required placeholder="Số lượng" style="flex:2;" />
          <select name="unit" style="flex:1;"><option>kg</option><option>thùng</option><option>bó</option><option>tấn</option></select>
        </div>
        <label>Đơn giá (₫)</label>
        <input name="price" type="number" inputmode="numeric" placeholder="VD: 15000" />
        <label>Khách hàng</label>
        <input name="customerName" placeholder="Tên khách hàng" />
        <label>Số điện thoại</label>
        <input name="customerPhone" type="tel" inputmode="numeric" pattern="[0-9+\s]+" placeholder="SĐT" />
        <label>Địa chỉ giao</label>
        <input name="customerAddr" placeholder="Địa chỉ" />
        <button type="submit" class="btn" style="margin-top:10px;">🛒 Tạo đơn + QR thanh toán</button>
      </form>
    </div>

    <p style="text-align:center; padding:20px; font-size:12px; color:var(--c-text-muted);">
      Mỗi sản phẩm bán ra đều kèm QR truy xuất nguồn gốc · Khách hàng quét là thấy toàn bộ nhật ký canh tác
    </p>
  `;
}

window.viewTrace = async (id) => {
  window.showToast?.('🔍 Đang mở truy xuất...', '');
  // Redirect to lot detail
  document.querySelector('[x-data]').__x.$data.nav('lots');
};

window.viewMarketQR = async (id) => {
  const el = document.getElementById('market-qr-' + id);
  if (!el) return;
  if (el.style.display !== 'none') { el.style.display = 'none'; return; }
  const lot = await lotStore.byId(id);
  if (!lot) return;
  const events = await lotStore.events(id);
  const qr = qrcode(0, 'M');
  qr.addData(lotStore.traceUrl(lot, events));
  qr.make();
  el.innerHTML = qr.createSvgTag({ cellSize: 3, margin: 0 });
  el.style.display = 'block';
};

window.quickOrder = async (id) => {
  const lot = await lotStore.byId(id);
  if (!lot) return;
  // Fill the form
  const sel = document.querySelector('[name="lotId"]');
  if (sel) sel.value = id;
  const qtyInput = document.querySelector('[name="qty"]');
  if (qtyInput && lot.harvest) qtyInput.value = Math.min(10, parseFloat(lot.harvest.qty) || 1);
  window.showToast?.('✓ Đã chọn sản phẩm, điền thông tin đơn hàng', 'ok');
  document.querySelector('[name="lotId"]')?.scrollIntoView({ behavior: 'smooth' });
};

window.wire_market = function() {

  document.getElementById('market-order-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const lot = await lotStore.byId(fd.get('lotId'));
      if (!lot) throw new Error('Không tìm thấy sản phẩm');
      const price = parseFloat(fd.get('price')) || 0;
      const qty = parseFloat(fd.get('qty')) || 1;
      const unit = fd.get('unit') || 'kg';
      const order = await orderStore.create({
        customer: {
          name: fd.get('customerName') || 'Khách HTX',
          phone: fd.get('customerPhone') || '',
          address: fd.get('customerAddr') || ''
        },
        items: [{
          name: `${lot.crop}${lot.variety ? ' - ' + lot.variety : ''} (${lot.code})`,
          qty,
          unit,
          price,
          lotId: lot.id
        }],
        totalAmount: price * qty,
        note: 'Đơn từ CHợ HTX Online — QR truy xuất: ' + lotStore.traceUrl(lot)
      });
      window.showToast?.(`✓ Đã tạo đơn ${order.code}`, 'ok');
      document.getElementById('market-order-form')?.reset();
      document.querySelector('[x-data]').__x.$data.nav('market');
    } catch (err) { window.showToast?.('✗ ' + err.message, 'err'); }
  });
};
