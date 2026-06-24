import { contractStore, CONTRACT_TYPES_LIST, CONTRACT_STATUSES_LIST } from '../stores/contract.js';

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function vnd(n) { return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0); }

export async function renderContract() {
  const list = await contractStore.getAll();
  const summary = await contractStore.getSummary();

  return `
    <div class="app-header">🤝 Hợp đồng
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('more')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>

    <div style="display:flex;gap:6px;padding:10px 16px;flex-wrap:wrap;">
      <div class="card" style="flex:1;padding:8px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:#2E7D32;">${summary.active}</div>
        <div style="font-size:10px;color:var(--c-text-muted);">Hiệu lực</div>
      </div>
      <div class="card" style="flex:1;padding:8px;text-align:center;">
        <div style="font-size:20px;font-weight:800;">${summary.total}</div>
        <div style="font-size:10px;color:var(--c-text-muted);">Tổng</div>
      </div>
      <div class="card" style="flex:1;padding:8px;text-align:center;">
        <div style="font-size:14px;font-weight:800;color:#1565C0;">${vnd(summary.totalValue)}</div>
        <div style="font-size:10px;color:var(--c-text-muted);">Giá trị</div>
      </div>
    </div>

    <div style="padding:0 16px 8px;">
      <button class="btn primary" style="width:100%;font-size:13px;" onclick="window.ctrShowForm()">➕ Thêm hợp đồng</button>
    </div>

    <div id="ctr-add-form" style="display:none;padding:12px;margin:0 16px 8px;border:2px solid var(--c-primary);border-radius:10px;">
      <div style="font-weight:700;margin-bottom:8px;">➕ Thêm hợp đồng</div>
      <input id="ctr-partner" class="form" placeholder="Tên đối tác *" />
      <div style="display:flex;gap:4px;">
        <input id="ctr-phone" class="form" type="tel" placeholder="SĐT" style="flex:1;" />
        <input id="ctr-addr" class="form" placeholder="Địa chỉ" style="flex:2;" />
      </div>
      <select id="ctr-type" class="form">${CONTRACT_TYPES_LIST.map(t => `<option value="${t.id}">${t.icon} ${esc(t.label)}</option>`).join('')}</select>
      <div style="display:flex;gap:4px;">
        <input id="ctr-crop" class="form" placeholder="Cây trồng / SP" style="flex:1;" />
        <input id="ctr-lot" class="form" placeholder="Mã lô" style="flex:1;" />
      </div>
      <div style="display:flex;gap:4px;">
        <input id="ctr-qty" class="form" type="number" placeholder="Số lượng" min="0" style="flex:1;" />
        <input id="ctr-unit" class="form" placeholder="ĐVT (kg)" style="width:60px;" value="kg" />
        <input id="ctr-price" class="form" type="number" placeholder="Đơn giá" min="0" style="flex:1;" />
      </div>
      <div style="display:flex;gap:4px;">
        <input id="ctr-start" class="form" type="date" placeholder="Ngày bắt đầu" />
        <input id="ctr-end" class="form" type="date" placeholder="Ngày kết thúc" />
      </div>
      <textarea id="ctr-notes" class="form" placeholder="Ghi chú" rows="2"></textarea>
      <button class="btn primary" style="width:100%;margin-top:6px;" onclick="window.ctrAdd()">💾 Lưu hợp đồng</button>
      <button class="btn secondary" style="width:100%;margin-top:4px;" onclick="document.getElementById('ctr-add-form').style.display='none'">Hủy</button>
    </div>

    <h3 style="padding:8px 16px 2px;font-size:13px;color:var(--c-text-muted);text-transform:uppercase;">Danh sách hợp đồng</h3>
    ${list.length === 0
      ? '<div class="empty" style="padding:20px;"><div class="ico">🤝</div><p>Chưa có hợp đồng nào.</p></div>'
      : list.map(c => {
          const ct = CONTRACT_TYPES_LIST.find(t => t.id === c.type);
          const cs = CONTRACT_STATUSES_LIST.find(s => s.id === c.status);
          const pct = c.quantity > 0 ? Math.round((c.delivered || 0) / c.quantity * 100) : 0;
          return `<div class="card" style="padding:10px;">
            <div class="row">
              <div>
                <div style="font-weight:600;">${ct ? ct.icon : '🤝'} ${esc(c.partnerName)}</div>
                <span style="font-size:11px;color:var(--c-text-muted);">${c.crop ? esc(c.crop) + ' · ' : ''}${vnd(c.totalValue)}</span>
              </div>
              <span style="background:${cs ? cs.color : '#999'};color:#fff;padding:2px 8px;border-radius:4px;font-size:10px;">${cs ? cs.label : c.status}</span>
            </div>
            <div style="font-size:12px;color:var(--c-text-muted);margin-top:4px;">
              📦 Đã giao: ${c.delivered || 0}/${c.quantity} ${c.unit} (${pct}%)
              <div style="height:4px;background:#e0e0e0;border-radius:2px;margin-top:3px;overflow:hidden;">
                <div style="height:100%;width:${pct}%;background:#2E7D32;border-radius:2px;"></div>
              </div>
            </div>
            <div style="display:flex;gap:4px;margin-top:6px;">
              <button class="btn small" onclick="window.ctrDelivery('${c.id}')" style="font-size:10px;">📦 Giao hàng</button>
              <button class="btn small" onclick="window.ctrStatus('${c.id}','completed')" style="font-size:10px;">✅ Hoàn tất</button>
              <button class="btn small danger" onclick="window.ctrDel('${c.id}')" style="font-size:10px;">🗑</button>
            </div>
            ${c.partnerPhone ? `<div style="font-size:11px;color:var(--c-text-muted);margin-top:2px;">📞 ${esc(c.partnerPhone)}</div>` : ''}
          </div>`;
        }).join('')}
  `;
}

window.ctrShowForm = () => {
  document.getElementById('ctr-add-form').style.display = 'block';
};

window.ctrAdd = async () => {
  const partner = document.getElementById('ctr-partner')?.value;
  if (!partner) { window.showToast?.('Nhập tên đối tác', 'err'); return; }
  const qty = document.getElementById('ctr-qty')?.value || 0;
  const price = document.getElementById('ctr-price')?.value || 0;
  await contractStore.add({
    partnerName: partner,
    partnerPhone: document.getElementById('ctr-phone')?.value || '',
    partnerAddress: document.getElementById('ctr-addr')?.value || '',
    type: document.getElementById('ctr-type')?.value || 'htx',
    crop: document.getElementById('ctr-crop')?.value || '',
    lotId: document.getElementById('ctr-lot')?.value || '',
    quantity: qty, unit: document.getElementById('ctr-unit')?.value || 'kg', price,
    startDate: document.getElementById('ctr-start')?.value || '',
    endDate: document.getElementById('ctr-end')?.value || '',
    notes: document.getElementById('ctr-notes')?.value || ''
  });
  window.showToast?.('✓ Đã thêm hợp đồng', 'ok');
  document.querySelector('[x-data]').__x?.$data?.nav?.('contract');
};

window.ctrDelivery = async (contractId) => {
  const qty = prompt('Số lượng giao:');
  if (!qty || +qty <= 0) return;
  const quality = prompt('Chất lượng / Phẩm cấp:') || '';
  await contractStore.addDelivery({ contractId, date: new Date().toISOString().slice(0, 10), quantity: +qty, quality, notes: '' });
  window.showToast?.('✓ Đã ghi nhận giao hàng', 'ok');
  document.querySelector('[x-data]').__x?.$data?.nav?.('contract');
};

window.ctrStatus = async (id, status) => {
  await contractStore.update(id, { status });
  window.showToast?.('✓ Đã cập nhật trạng thái', 'ok');
  document.querySelector('[x-data]').__x?.$data?.nav?.('contract');
};

window.ctrDel = async (id) => {
  if (!confirm('Xóa hợp đồng này?')) return;
  await contractStore.delete(id);
  window.showToast?.('✓ Đã xóa', 'ok');
  document.querySelector('[x-data]').__x?.$data?.nav?.('contract');
};

window.wire_contract = function () {};
