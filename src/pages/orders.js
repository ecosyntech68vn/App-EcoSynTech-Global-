import { orderStore, bankConfigStore } from '../stores/order.js';
import { lotStore } from '../db/trace.js';
import { jsPDF } from 'jspdf';
import qrcode from 'qrcode-generator';

function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function fmtMoney(v) { return (v || 0).toLocaleString('vi-VN') + '₫'; }

function fmtDate(iso) { return iso ? new Date(iso).toLocaleString('vi-VN') : '-'; }

function statusBadge(s) {
  const m = { pending: '⏳ Chờ', confirmed: '✅ Xác nhận', paid: '💳 Đã thanh toán', shipping: '🚚 Đang giao', delivered: '📦 Đã giao', cancelled: '❌ Huỷ' };
  const c = { pending: '#FF8F00', confirmed: '#2E7D32', paid: '#1565C0', shipping: '#6A1B9A', delivered: '#2E7D32', cancelled: '#c62828' };
  return `<span class="pill" style="background:${c[s] || '#999'};color:#fff;">${m[s] || s}</span>`;
}

function generateQrDataUrl(text, cellSize = 4, margin = 4) {
  try {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createDataURL(cellSize, margin);
  } catch { return ''; }
}

export async function renderOrders() {
  const orders = await orderStore.list();
  const stats = await orderStore.getStats();
  const bankCfg = await bankConfigStore.load();
  const bankList = bankConfigStore.getBankList();
  const lots = await lotStore.list().catch(() => []);
  const harvestLots = lots.filter(l => l.harvest && l.harvest.qty > 0);
  const customers = await orderStore.listCustomers();

  const orderCards = orders.map(o => `
    <div class="card" data-order-id="${escapeHtml(o.id)}" style="cursor:pointer;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div class="card-title">${escapeHtml(o.code)}</div>
          <div class="card-meta">${escapeHtml(o.customer.name || 'Khách lẻ')} · ${fmtDate(o.createdAt)}</div>
        </div>
        ${statusBadge(o.status)}
      </div>
      <div class="card-meta" style="margin-top:4px;">
        ${o.items.length} sản phẩm · Tổng: <strong>${fmtMoney(o.totalAmount)}</strong>
        ${o.paymentStatus === 'paid' ? '· ✅ Đã thanh toán' : '· ⏳ Chưa thanh toán'}
      </div>
    </div>`).join('') || '<div class="empty"><p>Chưa có đơn hàng nào.</p></div>';

  const productOptions = harvestLots.map(l => `
    <option value="${escapeHtml(l.id)}" data-crop="${escapeHtml(l.crop)}"
      data-qty="${l.harvest.qty}" data-unit="${escapeHtml(l.harvest.unit || 'kg')}">
      ${escapeHtml(l.code)} · ${escapeHtml(l.crop)} (${l.harvest.qty} ${l.harvest.unit || 'kg'})
    </option>`).join('');

  const customerOptions = customers.map(c => `
    <option value="${escapeHtml(c.phone)}" data-name="${escapeHtml(c.name)}" data-addr="${escapeHtml(c.address || '')}">
      ${escapeHtml(c.name)} · ${escapeHtml(c.phone)}
    </option>`).join('');

  return `
    <div class="app-header">🛒 Bán hàng & Đơn hàng
      <button onclick="document.querySelector('[x-data]').__x.\$data.nav('more')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>

    <div style="display:flex;gap:4px;padding:8px 16px;">
      <button class="btn primary" style="flex:1;font-size:12px;" onclick="window.orderTab('list')">📋 Đơn hàng</button>
      <button class="btn secondary" style="flex:1;font-size:12px;" onclick="window.orderTab('create')">➕ Tạo đơn</button>
      <button class="btn secondary" style="flex:1;font-size:12px;" onclick="window.orderTab('stats')">📊 Thống kê</button>
    </div>

    <div id="order-tab-content">
      <div style="display:flex;gap:8px;padding:8px 16px;flex-wrap:wrap;">
        <div class="card" style="flex:1;min-width:100px;text-align:center;padding:10px;">
          <div style="font-size:20px;font-weight:700;">${stats.total}</div>
          <div class="card-meta">Tổng đơn</div>
        </div>
        <div class="card" style="flex:1;min-width:100px;text-align:center;padding:10px;">
          <div style="font-size:20px;font-weight:700;color:#2E7D32;">${fmtMoney(stats.totalRevenue)}</div>
          <div class="card-meta">Đã thu</div>
        </div>
        <div class="card" style="flex:1;min-width:100px;text-align:center;padding:10px;">
          <div style="font-size:20px;font-weight:700;color:#FF8F00;">${fmtMoney(stats.pendingPayment)}</div>
          <div class="card-meta">Chờ thanh toán</div>
        </div>
      </div>

      <div style="padding:0 16px;margin-bottom:8px;">
        <input id="order-search" class="form" placeholder="🔍 Tìm theo mã, khách hàng..." style="width:100%;" />
      </div>

      <div id="order-list" style="padding:0 16px 80px;">
        ${orderCards}
      </div>
    </div>

    <div id="order-detail" style="display:none;padding:0 16px 80px;"></div>

    <div id="order-create" style="display:none;padding:0 16px 80px;">
      <div class="card">
        <div class="card-title">Thông tin khách hàng</div>
        <div style="display:flex;gap:4px;margin-bottom:4px;">
          <input id="ord-customer-search" class="form" list="ord-customer-list" placeholder="Chọn khách quen..." style="flex:1;" />
          <datalist id="ord-customer-list">${customerOptions}</datalist>
        </div>
        <input id="ord-customer-name" class="form" placeholder="Tên khách hàng *" style="margin-bottom:4px;" />
        <input id="ord-customer-phone" class="form" placeholder="Số điện thoại *" type="tel" style="margin-bottom:4px;" />
        <input id="ord-customer-addr" class="form" placeholder="Địa chỉ giao hàng" />
      </div>

      <div class="card">
        <div class="card-title">Sản phẩm</div>
        <div id="ord-items">
          <div class="ord-item" style="display:flex;gap:4px;margin-bottom:4px;">
            <select class="form ord-product" style="flex:2;font-size:12px;">
              <option value="">-- Chọn sản phẩm --</option>
              ${productOptions}
            </select>
            <input type="number" class="form ord-qty" placeholder="SL" style="flex:1;width:60px;" min="0" step="0.1" />
            <input type="number" class="form ord-price" placeholder="Giá/kg" style="flex:1;width:80px;" min="0" />
            <button class="ord-remove-item" style="background:none;border:0;color:#c62828;font-size:18px;cursor:pointer;">×</button>
          </div>
        </div>
        <button id="ord-add-item" class="btn secondary" style="width:100%;font-size:12px;">＋ Thêm sản phẩm</button>
      </div>

      <div class="card">
        <div class="card-title">Thanh toán</div>
        <select id="ord-payment" class="form">
          <option value="bank_transfer">🏦 Chuyển khoản (VietQR)</option>
          <option value="cod">💵 COD (tiền mặt)</option>
          <option value="momo">📱 MoMo</option>
        </select>
        <input id="ord-note" class="form" placeholder="Ghi chú đơn hàng" style="margin-top:4px;" />
        <div style="margin-top:8px;display:flex;justify-content:space-between;font-weight:600;">
          <span>Tạm tính:</span>
          <span id="ord-total-display">0₫</span>
        </div>
        <div style="margin-top:4px;display:flex;justify-content:space-between;font-weight:700;font-size:16px;">
          <span>Tổng cộng:</span>
          <span id="ord-grand-total" style="color:#2E7D32;">0₫</span>
        </div>
        <button id="ord-submit" class="btn primary" style="width:100%;margin-top:10px;font-size:15px;">📝 Tạo đơn hàng</button>
      </div>

      ${bankCfg.accountNo ? `
      <div class="card" style="border:1px dashed #0288D1;">
        <div class="card-meta" style="font-size:11px;">
          💳 QR thanh toán sẽ tạo tự động dựa trên tài khoản:
          <strong>${bankList.find(b => b.id === bankCfg.bankId)?.name || bankCfg.bankId}</strong>
          · ${bankCfg.accountNo} · ${escapeHtml(bankCfg.accountName)}
        </div>
      </div>` : `
      <div class="card crit">
        <div class="card-title">⚠ Chưa cấu hình tài khoản ngân hàng</div>
        <div class="card-meta">Vào <strong>Cài đặt → Ngân hàng</strong> để nhập số tài khoản nhận thanh toán, hỗ trợ VietQR.</div>
      </div>`}
    </div>
  `;
}

function wireOrderItemEvents() {
  document.getElementById('ord-add-item')?.addEventListener('click', () => {
    const template = document.querySelector('.ord-item');
    if (!template) return;
    const clone = template.cloneNode(true);
    clone.querySelector('.ord-product').value = '';
    clone.querySelector('.ord-qty').value = '';
    clone.querySelector('.ord-price').value = '';
    clone.querySelector('.ord-remove-item')?.addEventListener('click', function () {
      this.closest('.ord-item')?.remove();
      updateOrderTotal();
    });
    clone.querySelectorAll('.ord-qty, .ord-price, .ord-product').forEach(el => {
      el.addEventListener('input', updateOrderTotal);
    });
    document.getElementById('ord-items')?.appendChild(clone);
  });

  document.querySelectorAll('.ord-remove-item').forEach(btn => {
    btn.addEventListener('click', function () {
      if (document.querySelectorAll('.ord-item').length <= 1) return;
      this.closest('.ord-item')?.remove();
      updateOrderTotal();
    });
  });

  document.querySelectorAll('.ord-qty, .ord-price, .ord-product').forEach(el => {
    el.addEventListener('input', updateOrderTotal);
  });
}

function updateOrderTotal() {
  let total = 0;
  document.querySelectorAll('.ord-item').forEach(item => {
    const product = item.querySelector('.ord-product');
    const qty = parseFloat(item.querySelector('.ord-qty')?.value) || 0;
    const price = parseFloat(item.querySelector('.ord-price')?.value) || 0;
    total += qty * price;
  });
  const display = document.getElementById('ord-total-display');
  const grand = document.getElementById('ord-grand-total');
  if (display) display.textContent = total.toLocaleString('vi-VN') + '₫';
  if (grand) grand.textContent = total.toLocaleString('vi-VN') + '₫';
}

function generateInvoicePdf(order) {
  const doc = new jsPDF({ unit: 'mm', format: 'a5' });
  const pageW = 148;
  let y = 15;

  function text(t, x, s) { doc.text(t, x, y, s ? { align: s } : {}); y += 5; }
  function line() { y += 2; doc.line(10, y, pageW - 10, y); y += 4; }

  doc.setFontSize(16);
  text('HÓA ĐƠN BÁN HÀNG', pageW / 2, 'center');
  doc.setFontSize(10);
  text('EcoSynTech Farm OS', pageW / 2, 'center');
  text('Mã: ' + (order.code || ''), pageW / 2, 'center');
  line();

  doc.setFontSize(9);
  text('Khách: ' + (order.customer?.name || '-'), 14);
  text('ĐT: ' + (order.customer?.phone || '-'), 14);
  text('ĐC: ' + (order.customer?.address || '-'), 14);
  text('Ngày: ' + fmtDate(order.createdAt), 14);
  line();

  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  text('Sản phẩm', 14);
  doc.setFont(undefined, 'normal');
  for (const item of (order.items || [])) {
    const line = `${item.productName || '-'} x ${item.quantity || 0} ${item.unit || ''} = ${fmtMoney(item.quantity * item.price)}`;
    if (y > 140) { doc.addPage(); y = 20; }
    text(line, 14);
  }
  line();

  doc.setFontSize(11);
  doc.setFont(undefined, 'bold');
  text('Tổng cộng: ' + fmtMoney(order.totalAmount), pageW - 14, 'right');
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  text('PTTT: ' + (order.paymentMethod === 'bank_transfer' ? 'Chuyển khoản' : order.paymentMethod === 'cod' ? 'Tiền mặt' : order.paymentMethod), 14);
  text('TT thanh toán: ' + (order.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'), 14);
  line();

  if (order.shipping?.carrier) {
    text('Vận chuyển: ' + order.shipping.carrier + ' · ' + (order.shipping.trackingCode || '-'), 14);
  }

  doc.setFontSize(7);
  y = pageW > y + 10 ? y + 10 : pageW - 15;
  text('Hóa đơn này được tạo tự động từ hệ thống EcoSynTech Farm OS.', pageW / 2, 'center');
  text('Mọi thắc mắc vui lòng liên hệ người bán.', pageW / 2, 'center');

  return doc;
}

window.orderTab = function (tab) {
  document.getElementById('order-tab-content').style.display = tab === 'list' ? '' : 'none';
  document.getElementById('order-create').style.display = tab === 'create' ? '' : 'none';
  const el = document.getElementById('order-detail');
  if (el) el.style.display = 'none';

  document.querySelectorAll('[onclick*="orderTab"]').forEach(b => {
    b.className = 'btn ' + (b.textContent.includes(tab === 'list' ? 'Đơn hàng' : tab === 'create' ? 'Tạo đơn' : 'Thống kê' && tab === 'stats') ? 'primary' : 'secondary');
  });
};

window.wire_orders = function () {
  wireOrderItemEvents();

  document.getElementById('ord-customer-search')?.addEventListener('input', function () {
    const opt = document.querySelector(`#ord-customer-list option[value="${escapeHtml(this.value)}"]`);
    if (opt) {
      document.getElementById('ord-customer-name').value = opt.dataset.name || '';
      document.getElementById('ord-customer-addr').value = opt.dataset.addr || '';
      document.getElementById('ord-customer-phone').value = this.value;
    }
  });

  document.getElementById('ord-submit')?.addEventListener('click', async () => {
    const name = document.getElementById('ord-customer-name')?.value.trim();
    const phone = document.getElementById('ord-customer-phone')?.value.trim();
    const addr = document.getElementById('ord-customer-addr')?.value.trim();
    const payment = document.getElementById('ord-payment')?.value || 'bank_transfer';
    const note = document.getElementById('ord-note')?.value.trim() || '';

    if (!name || !phone) { window.showToast?.('Nhập tên và số điện thoại khách hàng', 'err'); return; }

    const items = [];
    document.querySelectorAll('.ord-item').forEach(item => {
      const sel = item.querySelector('.ord-product');
      const qty = parseFloat(item.querySelector('.ord-qty')?.value);
      const price = parseFloat(item.querySelector('.ord-price')?.value);
      const opt = sel?.selectedOptions?.[0];
      if (sel?.value && qty > 0 && price > 0) {
        items.push({ productId: sel.value, productName: opt?.dataset?.crop || sel.value, quantity: qty, price, unit: opt?.dataset?.unit || 'kg' });
      }
    });

    if (items.length === 0) { window.showToast?.('Thêm ít nhất 1 sản phẩm', 'err'); return; }

    const totalAmount = items.reduce((s, i) => s + i.quantity * i.price, 0);
    const btn = document.getElementById('ord-submit');
    btn.disabled = true; btn.textContent = 'Đang tạo...';

    try {
      const customer = { name, phone, address: addr || '' };
      const order = await orderStore.create({ customer, items, totalAmount, note, paymentMethod: payment });
      await orderStore.saveCustomer(customer);
      window.showToast?.('✅ Đã tạo đơn ' + order.code, 'ok');
      showOrderDetail(order.id);
      updateOrderTotal();
    } catch (e) { window.showToast?.('✗ ' + e.message, 'err'); }
    btn.disabled = false; btn.textContent = '📝 Tạo đơn hàng';
  });

  document.getElementById('order-search')?.addEventListener('input', function () {
    const q = this.value.toLowerCase().trim();
    document.querySelectorAll('#order-list .card[data-order-id]').forEach(el => {
      const txt = el.textContent.toLowerCase();
      el.style.display = txt.includes(q) ? '' : 'none';
    });
  });

  document.querySelectorAll('[data-order-id]').forEach(el => {
    el.addEventListener('click', () => showOrderDetail(el.dataset.orderId));
  });
};

async function showOrderDetail(id) {
  const order = await orderStore.get(id);
  if (!order) { window.showToast?.('Không tìm thấy đơn hàng', 'err'); return; }

  const bankCfg = await bankConfigStore.load();
  const bankList = bankConfigStore.getBankList();
  const bank = bankList.find(b => b.id === bankCfg.bankId);
  const qrText = order.paymentQR || '';
  let qrDataUrl = '';
  if (qrText) qrDataUrl = generateQrDataUrl(qrText, 5, 4);

  const itemsHtml = order.items.map(i => `
    <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--c-border);font-size:13px;">
      <span>${escapeHtml(i.productName)} × ${i.quantity} ${i.unit || ''}</span>
      <span style="font-weight:600;">${fmtMoney(i.quantity * i.price)}</span>
    </div>`).join('');

  const historyHtml = (order.history || []).map(h => `
    <div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0;">
      <span>${statusBadge(h.status)}</span>
      <span style="color:var(--c-text-muted);">${fmtDate(h.ts)}${h.note ? ' — ' + escapeHtml(h.note) : ''}</span>
    </div>`).join('');

  const canCancel = order.status === 'pending' || order.status === 'confirmed';
  const canConfirm = order.status === 'pending';
  const canPaid = order.status !== 'paid' && order.status !== 'cancelled';

  document.getElementById('order-tab-content').style.display = 'none';
  document.getElementById('order-create').style.display = 'none';
  const detailEl = document.getElementById('order-detail');
  detailEl.style.display = '';
  detailEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <h3 style="margin:0;">${escapeHtml(order.code)}</h3>
      ${statusBadge(order.status)}
    </div>

    <div class="card">
      <div class="card-title">👤 Khách hàng</div>
      <div class="card-meta"><strong>${escapeHtml(order.customer.name || '-')}</strong> · ${escapeHtml(order.customer.phone || '-')}</div>
      ${order.customer.address ? `<div class="card-meta">📍 ${escapeHtml(order.customer.address)}</div>` : ''}
      <div class="card-meta">📅 ${fmtDate(order.createdAt)}</div>
    </div>

    <div class="card">
      <div class="card-title">📦 Sản phẩm</div>
      ${itemsHtml}
      <div style="display:flex;justify-content:space-between;font-weight:700;font-size:15px;margin-top:6px;padding-top:6px;border-top:2px solid var(--c-border);">
        <span>Tổng cộng</span>
        <span style="color:#2E7D32;">${fmtMoney(order.totalAmount)}</span>
      </div>
      <div class="card-meta" style="margin-top:4px;">
        Thanh toán: <strong>${order.paymentMethod === 'bank_transfer' ? 'Chuyển khoản' : order.paymentMethod === 'cod' ? 'COD (tiền mặt)' : order.paymentMethod}</strong>
        · Trạng thái: ${order.paymentStatus === 'paid' ? '✅ Đã thanh toán ' + fmtDate(order.paidAt) : '⏳ Chưa thanh toán'}
      </div>
    </div>

    ${order.note ? `<div class="card"><div class="card-title">📝 Ghi chú</div><div class="card-meta">${escapeHtml(order.note)}</div></div>` : ''}

    ${order.shipping ? `
    <div class="card">
      <div class="card-title">🚚 Vận chuyển</div>
      <div class="card-meta">Đơn vị: ${escapeHtml(order.shipping.carrier || '-')} · Mã tracking: ${escapeHtml(order.shipping.trackingCode || '-')}</div>
      ${order.shipping.shippedAt ? `<div class="card-meta">Đã gửi: ${fmtDate(order.shipping.shippedAt)}</div>` : ''}
    </div>` : ''}

    ${qrDataUrl ? `
    <div class="card" style="text-align:center;border:2px dashed #0288D1;">
      <div class="card-title">💳 Quét QR để thanh toán</div>
      <img src="${qrDataUrl}" style="width:200px;height:200px;margin:8px auto;display:block;image-rendering:pixelated;" />
      <div class="card-meta" style="font-size:11px;">
        ${bank ? escapeHtml(bank.name) : ''} · ${escapeHtml(bankCfg.accountNo)}<br/>
        Số tiền: <strong>${fmtMoney(order.totalAmount)}</strong><br/>
        Nội dung: <strong>TT ${escapeHtml(order.code)}</strong>
      </div>
    </div>` : ''}

    <div class="card">
      <div class="card-title">📜 Lịch sử đơn hàng</div>
      ${historyHtml}
    </div>

    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">
      ${canConfirm ? `<button class="btn primary" data-order-action="confirm" style="flex:1;font-size:12px;">✅ Xác nhận</button>` : ''}
      ${canPaid ? `<button class="btn primary" data-order-action="pay" style="flex:1;font-size:12px;background:#1565C0;">💳 Đã thanh toán</button>` : ''}
      <button class="btn secondary" data-order-action="invoice" style="flex:1;font-size:12px;">📄 Hoá đơn PDF</button>
      ${canCancel ? `<button class="btn danger" data-order-action="cancel" style="flex:1;font-size:12px;">❌ Huỷ đơn</button>` : ''}
      <button class="btn secondary" onclick="window.orderTab('list');document.querySelector('[x-data]').__x.\$data.nav('orders');" style="flex:1;font-size:12px;">← Quay lại</button>
    </div>
  `;

  detailEl.querySelectorAll('[data-order-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.orderAction;
      try {
        if (action === 'confirm') {
          await orderStore.updateStatus(id, 'confirmed', 'Xác nhận đơn hàng');
          window.showToast?.('✅ Đã xác nhận đơn ' + order.code, 'ok');
        } else if (action === 'pay') {
          await orderStore.updateStatus(id, 'paid', 'Thanh toán thành công');
          window.showToast?.('💳 Đã ghi nhận thanh toán', 'ok');
        } else if (action === 'cancel') {
          if (!confirm('Huỷ đơn ' + order.code + '?')) return;
          await orderStore.updateStatus(id, 'cancelled', 'Khách huỷ');
          window.showToast?.('Đã huỷ đơn', '');
        } else if (action === 'invoice') {
          const doc = generateInvoicePdf(order);
          const pdfBase64 = doc.output('datauristring');
          const w = window.open('', '_blank');
          if (w) w.document.write(`<iframe src="${pdfBase64}" width="100%" height="100%" style="border:0;"></iframe>`);
          else {
            try {
              const { Share } = await import('@capacitor/share');
              const { Filesystem, Directory } = await import('@capacitor/filesystem');
              const filename = `invoice-${order.code}.pdf`;
              const data = doc.output('arraybuffer');
              const uint8 = new Uint8Array(data);
              let binary = '';
              for (let i = 0; i < uint8.byteLength; i++) binary += String.fromCharCode(uint8[i]);
              await Filesystem.writeFile({ path: filename, data: btoa(binary), directory: Directory.Documents });
              await Share.share({ title: filename, files: [filename] });
            } catch (e) { window.showToast?.('✗ ' + e.message, 'err'); }
          }
        }
        showOrderDetail(id);
      } catch (e) { window.showToast?.('✗ ' + e.message, 'err'); }
    });
  });
}
