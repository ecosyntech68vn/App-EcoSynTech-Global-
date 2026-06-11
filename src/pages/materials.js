// materials.js — V3.1 Danh mục vật tư (phân bón / thuốc BVTV) + PHI
// PHI (Pre-Harvest Interval) = số ngày cách ly bắt buộc trước thu hoạch.
import { materialsStore } from '../db/trace.js';

export async function renderMaterials() {
  const mats = await materialsStore.list();
  const TYPE_LBL = { fertilizer: '🧪 Phân bón', pesticide: '☠️ Thuốc BVTV', other: '📦 Khác' };
  return `
    <div class="app-header">📦 Vật tư + PHI
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('more')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>

    <div class="card">
      <div class="card-meta">PHI = thời gian cách ly trước thu hoạch. Khi ghi nhật ký dùng thuốc có PHI, lô tự động bị khoá thu hoạch đủ số ngày — đúng chuẩn VietGAP.</div>
    </div>

    <div class="form" style="padding-top:0;">
      <details>
        <summary class="btn secondary" style="display:block; text-align:center; cursor:pointer; list-style:none;">＋ Thêm vật tư</summary>
        <form id="mat-form" style="margin-top:12px;">
          <label>Tên vật tư *</label>
          <input name="name" required placeholder="Tên thương mại + hoạt chất" />
          <label>Loại</label>
          <select name="type">
            <option value="fertilizer">Phân bón</option>
            <option value="pesticide">Thuốc BVTV</option>
            <option value="other">Khác</option>
          </select>
          <label>PHI — ngày cách ly (0 nếu không áp dụng)</label>
          <input name="phiDays" type="number" min="0" max="60" value="0" />
          <label>Ghi chú</label>
          <input name="note" placeholder="Liều khuyến cáo, nhà cung cấp..." />
          <button type="submit" class="btn" style="margin-top:10px;">Lưu vật tư</button>
        </form>
      </details>
    </div>

    <h3 style="padding:14px 16px 4px; color:var(--c-text-muted); font-size:13px; text-transform:uppercase;">Danh mục (${mats.length})</h3>
    ${mats.map(m => `
      <div class="card">
        <div class="row">
          <div class="card-title" style="font-size:14px;">${escapeHtml(m.name)}</div>
          ${m.phiDays > 0 ? `<span class="pill pending-sync">PHI ${m.phiDays}d</span>` : '<span class="pill completed">Không PHI</span>'}
        </div>
        <div class="card-meta">${TYPE_LBL[m.type] || m.type}${m.note ? ' · ' + escapeHtml(m.note) : ''}</div>
        <div style="margin-top:6px;">
          <button data-mat-del="${escapeHtml(m.id)}" style="font-size:12px; padding:3px 10px; color:#c62828; background:none; border:1px solid var(--c-border); border-radius:6px;">Xoá</button>
        </div>
      </div>`).join('')}
  `;
}

function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

window.wire_materials = function() {
  const nav = () => document.querySelector('[x-data]').__x.$data.nav('materials');

  document.getElementById('mat-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await materialsStore.add({
        name: fd.get('name'), type: fd.get('type'),
        phiDays: fd.get('phiDays'), note: fd.get('note')
      });
      window.showToast?.('✓ Đã thêm vật tư', 'ok');
      nav();
    } catch (err) { window.showToast?.('✗ ' + err.message, 'err'); }
  });

  document.querySelectorAll('[data-mat-del]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Xoá vật tư này khỏi danh mục? (Nhật ký đã ghi không bị ảnh hưởng)')) return;
    await materialsStore.remove(b.dataset.matDel);
    nav();
  }));
};
