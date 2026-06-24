import { laborStore, LABOR_ROLES } from '../stores/labor.js';

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function roleOptions(selected) {
  return LABOR_ROLES.map(r => `<option value="${r.id}" ${r.id === selected ? 'selected' : ''}>${esc(r.label)}</option>`).join('');
}

export async function renderLabor() {
  const workers = await laborStore.getAllWorkers();
  const attendance = await laborStore.getAllAttendance(50);
  const payrolls = await laborStore.getPayrollHistory();

  return `
    <div class="app-header">👷 Nhân công
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('more')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>

    <div style="display:flex;gap:4px;padding:8px 16px;">
      <button class="btn primary" style="flex:1;font-size:12px;" onclick="window.labShowTab('workers')">👥 Danh sách</button>
      <button class="btn secondary" style="flex:1;font-size:12px;" onclick="window.labShowTab('attendance')">📋 Chấm công</button>
      <button class="btn secondary" style="flex:1;font-size:12px;" onclick="window.labShowTab('payroll')">💰 Lương</button>
    </div>

    <div id="lab-workers-tab">
      <div style="padding:0 16px 8px;">
        <button class="btn primary" style="width:100%;font-size:13px;" onclick="window.labShowForm()">➕ Thêm nhân công</button>
      </div>
      <div id="lab-add-form" style="display:none;padding:12px;margin:0 16px 8px;border:2px solid var(--c-primary);border-radius:10px;">
        <div style="font-weight:700;margin-bottom:8px;">➕ Thêm nhân công</div>
        <input id="lab-name" class="form" placeholder="Họ tên *" />
        <input id="lab-phone" class="form" type="tel" placeholder="Số điện thoại" />
        <select id="lab-role" class="form">${roleOptions('general')}</select>
        <input id="lab-rate" class="form" type="number" placeholder="Lương ngày (VNĐ)" min="0" />
        <button class="btn primary" style="width:100%;margin-top:6px;" onclick="window.labAddWorker()">💾 Lưu</button>
        <button class="btn secondary" style="width:100%;margin-top:4px;" onclick="document.getElementById('lab-add-form').style.display='none'">Hủy</button>
      </div>

      ${workers.length === 0
        ? '<div class="empty" style="padding:20px;"><div class="ico">👷</div><p>Chưa có nhân công nào. Thêm nhân công mới để bắt đầu.</p></div>'
        : workers.map(w => {
            const role = LABOR_ROLES.find(r => r.id === w.role);
            return `<div class="card" style="padding:10px;">
              <div class="row">
                <div>
                  <span style="font-weight:600;">${esc(w.name)}</span>
                  <span style="font-size:11px;color:var(--c-text-muted);margin-left:6px;">${role ? esc(role.label) : ''}</span>
                </div>
                <div>
                  <button class="btn small danger" onclick="window.labDelWorker('${w.id}')" style="padding:2px 6px;font-size:11px;">✕</button>
                </div>
              </div>
              ${w.phone ? `<div style="font-size:12px;color:var(--c-text-muted);">📞 ${esc(w.phone)}</div>` : ''}
              <div style="font-size:12px;color:var(--c-text-muted);">💰 ${(w.dailyRate || 0).toLocaleString('vi-VN')}đ/ngày</div>
              <div style="display:flex;gap:4px;margin-top:6px;">
                <button class="btn small" onclick="window.labCheckIn('${w.id}')" style="font-size:11px;">✅ Check-in</button>
                <button class="btn small" onclick="window.labCheckOut('${w.id}')" style="font-size:11px;">🔴 Check-out</button>
              </div>
            </div>`;
          }).join('')}
    </div>

    <div id="lab-attendance-tab" style="display:none;">
      <h3 style="padding:8px 16px 2px;font-size:13px;color:var(--c-text-muted);text-transform:uppercase;">Chấm công gần đây</h3>
      ${attendance.length === 0
        ? '<div class="empty" style="padding:20px;"><div class="ico">📋</div><p>Chưa có dữ liệu chấm công.</p></div>'
        : attendance.map(a => {
            const h = a.hours ? a.hours.toFixed(1) + 'h' : 'đang làm';
            return `<div class="card" style="padding:8px;">
              <div class="row">
                <span style="font-weight:600;">${esc(a.workerName)}</span>
                <span style="font-size:12px;color:var(--c-text-muted);">${a.date}</span>
              </div>
              <div style="font-size:12px;color:var(--c-text-muted);">⏱ ${h} ${a.task ? '· ' + esc(a.task) : ''}</div>
            </div>`;
          }).join('')}
    </div>

    <div id="lab-payroll-tab" style="display:none;">
      <div style="padding:0 16px 8px;">
        <label style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:13px;">Tuần bắt đầu:</span>
          <input id="lab-pay-week" class="form" type="date" style="flex:1;" />
          <button class="btn primary" style="font-size:12px;" onclick="window.labCalcPayroll()">Tính lương</button>
        </label>
      </div>
      <div id="lab-pay-result"></div>

      <h3 style="padding:8px 16px 2px;margin-top:8px;font-size:13px;color:var(--c-text-muted);text-transform:uppercase;">Lịch sử lương</h3>
      ${payrolls.length === 0
        ? '<div class="empty" style="padding:20px;"><div class="ico">💰</div><p>Chưa có kỳ lương nào.</p></div>'
        : payrolls.map(p => `<div class="card" style="padding:10px;">
            <div style="font-weight:600;">📅 Tuần ${p.weekStart}</div>
            <div style="font-size:12px;color:var(--c-text-muted);">${p.workers.length} nhân công · Tổng: ${(p.totalAmount || 0).toLocaleString('vi-VN')}đ</div>
            <div style="font-size:11px;margin-top:4px;">
              ${p.workers.map(w => `<span style="background:${w.paid ? '#E8F5E9' : '#FFF3E0'};padding:2px 6px;border-radius:4px;margin:2px;">${esc(w.workerName)}: ${(w.amount || 0).toLocaleString('vi-VN')}đ ${w.paid ? '✅' : '⏳'}</span>`).join(' ')}
            </div>
          </div>`).join('')}
    </div>
  `;
}

window.labShowTab = (tab) => {
  ['workers', 'attendance', 'payroll'].forEach(t => {
    const el = document.getElementById('lab-' + t + '-tab');
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });
  document.querySelectorAll('[onclick*="labShowTab"]').forEach(b => b.className = b.className.replace(' primary', ' secondary'));
  const btn = document.querySelector(`[onclick*="labShowTab('${tab}')"]`);
  if (btn) btn.className = btn.className.replace(' secondary', ' primary');
};

window.labShowForm = () => {
  document.getElementById('lab-add-form').style.display = 'block';
};

window.labAddWorker = async () => {
  const name = document.getElementById('lab-name')?.value;
  if (!name) { window.showToast?.('Nhập họ tên', 'err'); return; }
  await laborStore.addWorker({
    name, phone: document.getElementById('lab-phone')?.value || '',
    role: document.getElementById('lab-role')?.value || 'general',
    dailyRate: document.getElementById('lab-rate')?.value || 0
  });
  window.showToast?.('✓ Đã thêm nhân công', 'ok');
  document.querySelector('[x-data]').__x?.$data?.nav?.('labor');
};

window.labDelWorker = async (id) => {
  if (!confirm('Xóa nhân công này?')) return;
  await laborStore.deleteWorker(id);
  window.showToast?.('✓ Đã xóa', 'ok');
  document.querySelector('[x-data]').__x?.$data?.nav?.('labor');
};

window.labCheckIn = async (workerId) => {
  const lotId = prompt('Mã lô làm việc (nếu có):') || '';
  const task = prompt('Nhiệm vụ hôm nay:') || '';
  const result = await laborStore.checkIn(workerId, lotId, task);
  if (result) { window.showToast?.('✅ Check-in thành công', 'ok'); } else { window.showToast?.('✗ Lỗi check-in', 'err'); }
};

window.labCheckOut = async (workerId) => {
  const result = await laborStore.checkOut(workerId);
  if (result) { window.showToast?.('🔴 Check-out thành công - ' + result.hours + 'h', 'ok'); } else { window.showToast?.('✗ Chưa có check-in hôm nay', ''); }
};

window.labCalcPayroll = async () => {
  const weekStart = document.getElementById('lab-pay-week')?.value;
  if (!weekStart) { window.showToast?.('Chọn ngày bắt đầu tuần', 'err'); return; }
  const result = await laborStore.calculatePayroll(weekStart);
  const container = document.getElementById('lab-pay-result');
  if (!result.length) {
    container.innerHTML = '<div class="empty" style="padding:16px;"><p>Không có dữ liệu chấm công trong tuần này.</p></div>';
    return;
  }
  const total = result.reduce((s, w) => s + w.amount, 0);
  container.innerHTML = `
    <div class="card" style="padding:12px;margin:8px 16px;border-color:#2E7D32;">
      <div style="font-weight:700;margin-bottom:6px;">📊 Bảng lương tuần ${weekStart}</div>
      ${result.map(w => `<div class="row" style="margin:4px 0;">
        <span>${esc(w.workerName)} (${w.daysWorked} ngày, ${w.hoursTotal.toFixed(1)}h)</span>
        <span style="font-weight:600;">${(w.amount || 0).toLocaleString('vi-VN')}đ</span>
      </div>`).join('')}
      <hr style="margin:8px 0;border:0;border-top:1px solid var(--c-border);" />
      <div class="row">
        <span style="font-weight:700;">Tổng cộng</span>
        <span style="font-weight:700;color:#2E7D32;font-size:16px;">${(total || 0).toLocaleString('vi-VN')}đ</span>
      </div>
      <button class="btn primary" style="width:100%;margin-top:8px;" onclick="window.labSavePayroll('${weekStart}', ${total})">💾 Lưu bảng lương</button>
    </div>
  `;
};

window.labSavePayroll = async (weekStart, totalAmount) => {
  const result = await laborStore.calculatePayroll(weekStart);
  const workers = result.map(w => ({
    workerId: w.workerId, workerName: w.workerName,
    daysWorked: w.daysWorked, amount: w.amount
  }));
  await laborStore.savePayroll({ weekStart, workers, totalAmount });
  window.showToast?.('✓ Đã lưu bảng lương', 'ok');
  document.querySelector('[x-data]').__x?.$data?.nav?.('labor');
};

window.wire_labor = function () {};
