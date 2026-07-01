import { equipmentStore, EQUIPMENT_TYPES, MAINTENANCE_TYPES } from '../stores/equipment.js';

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

const STATUS_MAP = {
  active: { label: 'Hoạt động', color: '#2E7D32', bg: '#E8F5E9' },
  maintenance: { label: 'Bảo trì', color: '#F57F17', bg: '#FFF8E1' },
  broken: { label: 'Hỏng', color: '#c62828', bg: '#FFEBEE' },
  retired: { label: 'Thanh lý', color: '#999', bg: '#f5f5f5' }
};

export async function renderEquipment() {
  const list = await equipmentStore.getAll();
  const summary = await equipmentStore.getSummary();

  const typeIcons = {};
  EQUIPMENT_TYPES.forEach(t => { typeIcons[t.id] = t.icon; });

  return `
    <div class="app-header">🔧 Thiết bị
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('more')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>

    <div style="display:flex;gap:6px;padding:10px 16px;flex-wrap:wrap;">
      <div class="card" style="flex:1;padding:8px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:#2E7D32;">${summary.active}</div>
        <div style="font-size:10px;color:var(--c-text-muted);">Đang chạy</div>
      </div>
      <div class="card" style="flex:1;padding:8px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:#F57F17;">${summary.maintenance}</div>
        <div style="font-size:10px;color:var(--c-text-muted);">Bảo trì</div>
      </div>
      <div class="card" style="flex:1;padding:8px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:#c62828;">${summary.broken}</div>
        <div style="font-size:10px;color:var(--c-text-muted);">Hỏng</div>
      </div>
      <div class="card" style="flex:1;padding:8px;text-align:center;">
        <div style="font-size:20px;font-weight:800;">${summary.total}</div>
        <div style="font-size:10px;color:var(--c-text-muted);">Tổng</div>
      </div>
    </div>

    ${summary.dueCount > 0 ? `
    <div class="card crit" style="margin:0 16px 8px;">
      <div class="card-title">🔔 ${summary.dueCount} thiết bị đến hạn bảo dưỡng</div>
      ${summary.dueList.slice(0, 5).map(eq => `
        <div style="font-size:12px;padding:2px 0;">• ${esc(eq.name)} (chu kỳ ${eq.maintenanceIntervalDays} ngày)</div>`).join('')}
      <div class="card-meta" style="margin-top:4px;">Vào chi tiết thiết bị để ghi bảo dưỡng</div>
    </div>` : ''}

    <div style="padding:0 16px 8px;">
      <button class="btn primary" style="width:100%;font-size:13px;" onclick="window.eqShowForm()">➕ Thêm thiết bị</button>
    </div>

    <div id="eq-add-form" style="display:none;padding:12px;margin:0 16px 8px;border:2px solid var(--c-primary);border-radius:10px;">
      <div style="font-weight:700;margin-bottom:8px;">➕ Thêm thiết bị</div>
      <input id="eq-name" class="form" placeholder="Tên thiết bị *" />
      <select id="eq-type" class="form">${EQUIPMENT_TYPES.map(t => `<option value="${t.id}">${t.icon} ${esc(t.label)}</option>`).join('')}</select>
      <div style="display:flex;gap:4px;">
        <input id="eq-brand" class="form" placeholder="Hãng" style="flex:1;" />
        <input id="eq-model" class="form" placeholder="Model" style="flex:1;" />
      </div>
      <input id="eq-purchase" class="form" type="date" placeholder="Ngày mua" />
      <input id="eq-zone" class="form" placeholder="Zone (ví dụ: Z1)" />
      <input id="eq-maint-interval" class="form" type="number" placeholder="Chu kỳ bảo dưỡng (ngày) — VD: 90" />
      <textarea id="eq-notes" class="form" placeholder="Ghi chú" rows="2"></textarea>
      <button class="btn primary" style="width:100%;margin-top:6px;" onclick="window.eqAdd()">💾 Lưu</button>
      <button class="btn secondary" style="width:100%;margin-top:4px;" onclick="document.getElementById('eq-add-form').style.display='none'">Hủy</button>
    </div>

    <h3 style="padding:8px 16px 2px;font-size:13px;color:var(--c-text-muted);text-transform:uppercase;">Danh sách thiết bị</h3>
    ${list.length === 0
      ? '<div class="empty" style="padding:20px;"><div class="ico">🔧</div><p>Chưa có thiết bị nào.</p></div>'
      : list.map(e => {
          const st = STATUS_MAP[e.status] || STATUS_MAP.active;
          const icon = typeIcons[e.type] || '📦';
          return `<div class="card" style="padding:10px;">
            <div class="row">
              <div>
                <span style="font-weight:600;">${icon} ${esc(e.name)}</span>
                <span style="background:${st.bg};color:${st.color};padding:2px 6px;border-radius:4px;font-size:10px;margin-left:6px;">${st.label}</span>
              </div>
              <button class="btn small" onclick="window.eqDetail('${e.id}')" style="padding:2px 8px;">🔍</button>
            </div>
            <div style="font-size:12px;color:var(--c-text-muted);margin-top:2px;">
              ${e.brand ? esc(e.brand) : ''} ${e.model ? esc(e.model) : ''}
              ${e.zoneId ? '· ' + esc(e.zoneId) : ''}
            </div>
          </div>`;
        }).join('')}

    <div id="eq-detail" style="display:none;"></div>
  `;
}

window.eqShowForm = () => {
  document.getElementById('eq-add-form').style.display = 'block';
};

window.eqAdd = async () => {
  const name = document.getElementById('eq-name')?.value;
  if (!name) { window.showToast?.('Nhập tên thiết bị', 'err'); return; }
  await equipmentStore.add({
    name,
    type: document.getElementById('eq-type')?.value || 'other',
    brand: document.getElementById('eq-brand')?.value || '',
    model: document.getElementById('eq-model')?.value || '',
    purchaseDate: document.getElementById('eq-purchase')?.value || '',
    zoneId: document.getElementById('eq-zone')?.value || '',
    maintenanceIntervalDays: parseInt(document.getElementById('eq-maint-interval')?.value) || 0,
    notes: document.getElementById('eq-notes')?.value || ''
  });
  window.showToast?.('✓ Đã thêm thiết bị', 'ok');
  document.querySelector('[x-data]').__x?.$data?.nav?.('equipment');
};

window.eqDetail = async (id) => {
  const eq = await equipmentStore.getById(id);
  if (!eq) return;
  const mnt = await equipmentStore.getMaintenance(id, 10);
  const fuel = await equipmentStore.getFuel(id, 10);
  const st = STATUS_MAP[eq.status] || STATUS_MAP.active;
  const icon = EQUIPMENT_TYPES.find(t => t.id === eq.type)?.icon || '📦';

  const container = document.getElementById('eq-detail');
  container.style.display = 'block';
  container.innerHTML = `
    <div class="card" style="padding:12px;margin:8px 16px;border:2px solid var(--c-primary);">
      <div style="font-weight:700;font-size:15px;">${icon} ${esc(eq.name)}</div>
      <div style="font-size:12px;color:var(--c-text-muted);margin-top:4px;">
        ${eq.brand ? esc(eq.brand) + ' ' : ''}${eq.model ? esc(eq.model) : ''}
        <span style="background:${st.bg};color:${st.color};padding:2px 6px;border-radius:4px;margin-left:4px;">${st.label}</span>
      </div>
      ${eq.purchaseDate ? `<div style="font-size:12px;color:var(--c-text-muted);">📅 Mua: ${eq.purchaseDate}</div>` : ''}
      ${eq.zoneId ? `<div style="font-size:12px;color:var(--c-text-muted);">📍 Zone: ${esc(eq.zoneId)}</div>` : ''}
      ${eq.notes ? `<div style="font-size:12px;color:var(--c-text-muted);">📝 ${esc(eq.notes)}</div>` : ''}

      <div style="display:flex;gap:4px;margin-top:8px;">
        <button class="btn small" onclick="window.eqStatus('${eq.id}','active')" style="font-size:10px;">✅ Hoạt động</button>
        <button class="btn small" onclick="window.eqStatus('${eq.id}','maintenance')" style="font-size:10px;">🔧 Bảo trì</button>
        <button class="btn small" onclick="window.eqStatus('${eq.id}','broken')" style="font-size:10px;">🚫 Hỏng</button>
        <button class="btn small danger" onclick="window.eqDel('${eq.id}')" style="font-size:10px;">🗑</button>
      </div>

      <hr style="margin:10px 0;border:0;border-top:1px solid var(--c-border);" />
      <div style="font-weight:600;font-size:13px;margin-bottom:6px;">🔧 Lịch sử bảo trì</div>
      <div style="display:flex;gap:4px;margin-bottom:6px;">
        <select id="eq-mnt-type" class="form" style="flex:1;">${MAINTENANCE_TYPES.map(t => `<option value="${t.id}">${t.label}</option>`).join('')}</select>
        <input id="eq-mnt-cost" class="form" type="number" placeholder="Phí" style="width:80px;" />
      </div>
      <input id="eq-mnt-notes" class="form" placeholder="Ghi chú" />
      <div style="display:flex;gap:4px;">
        <input id="eq-mnt-date" class="form" type="date" value="${new Date().toISOString().slice(0, 10)}" style="flex:1;" />
        <input id="eq-mnt-next" class="form" type="date" placeholder="Hạn kế tiếp" style="flex:1;" />
      </div>
      <button class="btn primary" style="width:100%;margin-top:4px;font-size:12px;" onclick="window.eqAddMnt('${eq.id}')">+ Thêm bảo trì</button>
      ${mnt.map(m => {
        const mt = MAINTENANCE_TYPES.find(t => t.id === m.type);
        return `<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--c-border);">
          ${m.date} · ${mt ? mt.label : m.type} ${m.cost ? '· ' + m.cost.toLocaleString('vi-VN') + 'đ' : ''}
          ${m.notes ? '· ' + esc(m.notes) : ''}
        </div>`;
      }).join('')}

      <hr style="margin:10px 0;border:0;border-top:1px solid var(--c-border);" />
      <div style="font-weight:600;font-size:13px;margin-bottom:6px;">⛽ Nhiên liệu</div>
      <div style="display:flex;gap:4px;margin-bottom:6px;">
        <input id="eq-fuel-liters" class="form" type="number" placeholder="Lít" step="0.5" style="flex:1;" />
        <input id="eq-fuel-cost" class="form" type="number" placeholder="VNĐ" style="width:100px;" />
      </div>
      <input id="eq-fuel-notes" class="form" placeholder="Ghi chú" />
      <button class="btn primary" style="width:100%;margin-top:4px;font-size:12px;" onclick="window.eqAddFuel('${eq.id}')">+ Thêm nhiên liệu</button>
      ${fuel.map(f => `<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--c-border);">
        ${f.date} · ${f.liters}L ${f.cost ? '· ' + f.cost.toLocaleString('vi-VN') + 'đ' : ''}
        ${f.notes ? '· ' + esc(f.notes) : ''}
      </div>`).join('')}
    </div>
  `;
};

window.eqStatus = async (id, status) => {
  await equipmentStore.update(id, { status });
  window.showToast?.('✓ Đã cập nhật trạng thái', 'ok');
  window.eqDetail(id);
};

window.eqDel = async (id) => {
  if (!confirm('Xóa thiết bị này?')) return;
  await equipmentStore.delete(id);
  document.querySelector('[x-data]').__x?.$data?.nav?.('equipment');
};

window.eqAddMnt = async (equipId) => {
  await equipmentStore.addMaintenance({
    equipId,
    type: document.getElementById('eq-mnt-type')?.value || 'general',
    cost: document.getElementById('eq-mnt-cost')?.value || 0,
    notes: document.getElementById('eq-mnt-notes')?.value || '',
    date: document.getElementById('eq-mnt-date')?.value || '',
    nextDue: document.getElementById('eq-mnt-next')?.value || ''
  });
  window.showToast?.('✓ Đã thêm bảo trì', 'ok');
  window.eqDetail(equipId);
};

window.eqAddFuel = async (equipId) => {
  const liters = document.getElementById('eq-fuel-liters')?.value;
  if (!liters || +liters <= 0) { window.showToast?.('Nhập số lít', 'err'); return; }
  await equipmentStore.addFuel({
    equipId,
    liters,
    cost: document.getElementById('eq-fuel-cost')?.value || 0,
    notes: document.getElementById('eq-fuel-notes')?.value || '',
    date: new Date().toISOString().slice(0, 10)
  });
  window.showToast?.('✓ Đã thêm nhiên liệu', 'ok');
  window.eqDetail(equipId);
};

window.wire_equipment = function () {};
