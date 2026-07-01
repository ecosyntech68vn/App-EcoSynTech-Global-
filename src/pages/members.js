import { memberStore } from '../stores/member.js';
import { lotStore } from '../db/trace.js';

export async function renderMembers() {
  const members = await memberStore.list();
  const summary = await memberStore.productionSummary();
  const lots = await lotStore.list();

  let html = `
    <div class="app-header">👥 Xã viên HTX
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('more')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>

    <div class="form" style="padding-bottom:0;">
      <details>
        <summary class="btn secondary" style="display:block;text-align:center;cursor:pointer;list-style:none;">＋ Thêm xã viên</summary>
        <form id="member-form" style="margin-top:12px;">
          <label>Họ tên *</label>
          <input name="name" required />
          <label>Số điện thoại</label>
          <input name="phone" type="tel" />
          <label>Địa chỉ</label>
          <input name="address" />
          <label>Ghi chú</label>
          <textarea name="note"></textarea>
          <button type="submit" class="btn" style="margin-top:10px;">Thêm</button>
        </form>
      </details>
    </div>

    ${members.length === 0 ? `<div class="empty"><p>Chưa có xã viên nào. Thêm xã viên để giao lô cho họ.</p></div>` : ''}

    <h3 style="padding:14px 16px 4px;color:var(--c-text-muted);font-size:13px;text-transform:uppercase;">Xã viên (${members.length})</h3>
  `;

  for (const m of members) {
    const s = summary.find(x => x.member.id === m.id);
    const memberLots = lots.filter(l => l.memberId === m.id);
    html += `
      <div class="card">
        <div class="row">
          <div class="card-title">${escapeHtml(m.name)}</div>
          <span class="pill">${s ? s.activeLots + ' lô' : '0 lô'}</span>
        </div>
        ${m.phone ? `<div class="card-meta">📞 ${escapeHtml(m.phone)}</div>` : ''}
        ${m.address ? `<div class="card-meta">📍 ${escapeHtml(m.address)}</div>` : ''}
        <div class="card-meta" style="margin-top:4px;">
          Thu hoạch: <strong>${s ? s.totalYield : 0} kg</strong>
          · ${s ? s.harvestedLots : 0} lô đã thu
          ${s?.estimatedRevenue ? ` · 💰 ${esc((s.estimatedRevenue/1000000).toFixed(0))}tr` : ''}
        </div>
        ${memberLots.length > 0 ? `
        <details style="margin-top:6px;">
          <summary style="cursor:pointer;font-size:12px;color:var(--c-text-muted);">📋 ${memberLots.length} lô đã giao</summary>
          ${memberLots.map(l => `
            <div style="font-size:12px;padding:4px 0 0 12px;">
              <strong>${esc(l.crop)}</strong> · ${esc(l.code)} · 
              ${l.status === 'growing' ? '🌱' : '✓'} 
              ${l.harvest ? esc(String(l.harvest.qty || '')) + esc(l.harvest.unit || '') : ''}
            </div>`).join('')}
        </details>` : ''}
        <div style="margin-top:8px;">
          <button class="btn small danger" onclick="window.memberDelete('${m.id}')" style="font-size:11px;">Xoá</button>
        </div>
      </div>`;
  }

  return html;
}

function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

window.memberDelete = async (id) => {
  if (!confirm('Xoá xã viên này?')) return;
  await memberStore.remove(id);
  document.querySelector('[x-data]').__x.$data.nav('members');
};

window.wire_members = function() {
  document.getElementById('member-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await memberStore.add({ name: fd.get('name'), phone: fd.get('phone'), address: fd.get('address'), note: fd.get('note') });
      window.showToast?.('✓ Đã thêm xã viên', 'ok');
      document.querySelector('[x-data]').__x.$data.nav('members');
    } catch (err) { window.showToast?.('✗ ' + err.message, 'err'); }
  });
};
