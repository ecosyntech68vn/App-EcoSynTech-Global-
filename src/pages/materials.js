// materials.js — V5 Danh mục vật tư CHUẨN HOÁ + tồn kho + ảnh khai báo.
// Thuộc tính đặc thù theo loại (thuốc BVTV: hoạt chất/nhóm độc/số ĐK/dạng/công dụng;
// phân bón: NPK/dạng). PHI giữ chuẩn VietGAP. Tồn kho: qty + nhập/xuất + cảnh báo sắp hết.
import { materialsStore } from '../db/trace.js';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

const TYPE_LBL = { fertilizer: '🧪 Phân bón', pesticide: '☠️ Thuốc BVTV', other: '📦 Khác' };

export async function renderMaterials() {
  const mats = await materialsStore.list();
  const low = mats.filter(m => m.stock && m.stock.lowAt > 0 && m.stock.qty <= m.stock.lowAt).length;
  return `
    <div class="app-header">📦 Vật tư + Tồn kho
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('more')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>

    <div class="card">
      <div class="card-meta">PHI = thời gian cách ly trước thu hoạch — ghi nhật ký dùng thuốc có PHI → lô tự khoá thu hoạch (chuẩn VietGAP). Khai báo đủ hoạt chất + số đăng ký để truy xuất chuẩn xuất khẩu.</div>
      ${low > 0 ? `<div class="card-meta" style="color:#c62828; margin-top:6px;">⚠ ${low} vật tư sắp hết — cần nhập thêm.</div>` : ''}
    </div>

    <div class="form" style="padding-top:0;">
      <details>
        <summary class="btn secondary" style="display:block; text-align:center; cursor:pointer; list-style:none;">＋ Thêm vật tư</summary>
        <form id="mat-form" style="margin-top:12px;">
          <label>Tên vật tư *</label>
          <input name="name" required placeholder="Tên thương mại" />
          <label>Loại</label>
          <select name="type" id="mat-type">
            <option value="fertilizer">Phân bón</option>
            <option value="pesticide">Thuốc BVTV</option>
            <option value="other">Khác</option>
          </select>

          <div class="matfields" data-t="pesticide" style="display:none;">
            <label>Hoạt chất</label>
            <input name="activeIngredient" placeholder="VD: Emamectin benzoate 1.9%" />
            <label>Công dụng / đối tượng phòng trừ</label>
            <input name="use" placeholder="VD: trừ sâu tơ, sâu xanh, bệnh sương mai" />
            <label>Nhóm độc</label>
            <select name="toxicity"><option value="">—</option><option>I (rất độc)</option><option>II (độc cao)</option><option>III (độc TB)</option><option>IV (ít độc)</option></select>
            <label>Dạng thuốc</label>
            <select name="form"><option value="">—</option><option>EC (nhũ dầu)</option><option>WP (bột thấm nước)</option><option>SC (huyền phù)</option><option>WG (hạt phân tán)</option><option>SL (dung dịch)</option></select>
            <label>Số đăng ký lưu hành (ĐKVN)</label>
            <input name="regNo" placeholder="Bắt buộc khai báo theo quy định" />
          </div>

          <div class="matfields" data-t="fertilizer" style="display:none;">
            <label>Công thức / NPK</label>
            <input name="npk" placeholder="VD: 16-16-8+TE" />
            <label>Dạng</label>
            <select name="formF"><option value="">—</option><option>Bột</option><option>Hạt</option><option>Lỏng</option><option>Hữu cơ hoai</option></select>
          </div>

          <label>Nhà sản xuất / cung cấp</label>
          <input name="manufacturer" placeholder="Tên NSX / đại lý" />

          <label>PHI — ngày cách ly (0 nếu không áp dụng)</label>
          <input name="phiDays" type="number" min="0" max="60" value="0" />

          <label>Tồn kho hiện có</label>
          <div style="display:flex; gap:8px;">
            <input name="stockQty" type="number" step="0.1" placeholder="Số lượng" style="flex:2;" />
            <input name="stockUnit" placeholder="chai, kg, lít, gói" style="flex:2;" />
          </div>
          <label>Cảnh báo khi tồn còn ≤</label>
          <input name="lowAt" type="number" step="0.1" placeholder="VD: 2 (để 0 = không cảnh báo)" />

          <label>Ghi chú</label>
          <input name="note" placeholder="Liều khuyến cáo, lưu ý an toàn..." />

          <label>Ảnh nhãn / bao bì (khai báo)</label>
          <div style="display:flex; gap:10px;">
            <button type="button" id="mat-photo" class="btn secondary" style="flex:1;">📷 Chụp ảnh</button>
            <div id="mat-photo-preview" style="width:60px; height:60px; border:1px dashed var(--c-border); border-radius:8px; background:#f5f5f5; display:flex; align-items:center; justify-content:center; font-size:24px; color:var(--c-text-muted);">-</div>
          </div>
          <input type="hidden" name="photoPath" />

          <button type="submit" class="btn" style="margin-top:10px;">Lưu vật tư</button>
        </form>
      </details>
    </div>

    <h3 style="padding:14px 16px 4px; color:var(--c-text-muted); font-size:13px; text-transform:uppercase;">Danh mục (${mats.length})</h3>
    ${mats.map(m => {
      const st = m.stock || { qty: 0, unit: '', lowAt: 0 };
      const isLow = st.lowAt > 0 && st.qty <= st.lowAt;
      const attr = [
        m.activeIngredient && 'HC: ' + m.activeIngredient,
        m.npk && 'NPK: ' + m.npk,
        m.use && 'Công dụng: ' + m.use,
        m.toxicity && 'Độc: ' + m.toxicity,
        m.form && m.form, m.formF && m.formF,
        m.regNo && 'ĐK: ' + m.regNo,
        m.manufacturer && 'NSX: ' + m.manufacturer,
      ].filter(Boolean).map(escapeHtml).join(' · ');
      return `
      <div class="card ${isLow ? 'warn' : ''}">
        <div class="row">
          <div class="card-title" style="font-size:14px;">${escapeHtml(m.name)}</div>
          ${m.phiDays > 0 ? `<span class="pill pending-sync">PHI ${m.phiDays}d</span>` : '<span class="pill completed">Không PHI</span>'}
        </div>
        <div class="card-meta">${TYPE_LBL[m.type] || m.type}${attr ? ' · ' + attr : ''}</div>
        ${m.note ? `<div class="card-meta">${escapeHtml(m.note)}</div>` : ''}
        <div class="row" style="margin-top:8px; align-items:center;">
          <div class="card-meta">Tồn: <strong style="color:${isLow ? '#c62828' : 'inherit'};">${st.qty}${st.unit ? ' ' + escapeHtml(st.unit) : ''}</strong>${isLow ? ' ⚠ sắp hết' : ''}</div>
          <div style="display:flex; gap:6px;">
            <button data-mat-adj="${escapeHtml(m.id)}" data-d="-1" style="padding:2px 10px; border:1px solid var(--c-border); border-radius:6px; background:none;">−</button>
            <button data-mat-adj="${escapeHtml(m.id)}" data-d="1" style="padding:2px 10px; border:1px solid var(--c-border); border-radius:6px; background:none;">＋</button>
          </div>
        </div>
        ${m.photoPath ? `<img src="${escapeHtml(m.photoPath)}" style="margin-top:8px; max-width:100%; max-height:120px; border-radius:8px;" />` : ''}
        <div style="margin-top:6px;">
          <button data-mat-del="${escapeHtml(m.id)}" style="font-size:12px; padding:3px 10px; color:#c62828; background:none; border:1px solid var(--c-border); border-radius:6px;">Xoá</button>
        </div>
      </div>`;
    }).join('')}
  `;
}

function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

window.wire_materials = function() {
  const nav = () => document.querySelector('[x-data]').__x.$data.nav('materials');

  // Hiện field đặc thù theo loại
  const typeSel = document.getElementById('mat-type');
  const refresh = () => document.querySelectorAll('.matfields').forEach(el => { el.style.display = el.dataset.t === typeSel.value ? 'block' : 'none'; });
  typeSel?.addEventListener('change', refresh); refresh();

  // Chụp ảnh nhãn
  document.getElementById('mat-photo')?.addEventListener('click', async () => {
    try {
      const photo = await Camera.getPhoto({ quality: 70, allowEditing: false, resultType: CameraResultType.Uri, source: CameraSource.Camera, width: 1280 });
      const uri = photo.webPath || photo.path;
      document.querySelector('input[name=photoPath]').value = uri || '';
      const pv = document.getElementById('mat-photo-preview');
      if (pv && uri) pv.innerHTML = `<img src="${uri}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" />`;
    } catch (e) { window.showToast?.('Không chụp được ảnh: ' + e.message, 'err'); }
  });

  document.getElementById('mat-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await materialsStore.add({
        name: fd.get('name'), type: fd.get('type'), phiDays: fd.get('phiDays'),
        activeIngredient: fd.get('activeIngredient') || '', use: fd.get('use') || '',
        toxicity: fd.get('toxicity') || '', form: fd.get('form') || fd.get('formF') || '',
        regNo: fd.get('regNo') || '', npk: fd.get('npk') || '',
        manufacturer: fd.get('manufacturer') || '', note: fd.get('note') || '',
        photoPath: fd.get('photoPath') || '',
        stockQty: fd.get('stockQty'), stockUnit: fd.get('stockUnit'), lowAt: fd.get('lowAt'),
      });
      window.showToast?.('✓ Đã thêm vật tư', 'ok');
      nav();
    } catch (err) { window.showToast?.('✗ ' + err.message, 'err'); }
  });

  // Nhập/xuất tồn kho nhanh
  document.querySelectorAll('[data-mat-adj]').forEach(b => b.addEventListener('click', async () => {
    await materialsStore.adjustStock(b.dataset.matAdj, Number(b.dataset.d));
    nav();
  }));

  document.querySelectorAll('[data-mat-del]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Xoá vật tư này khỏi danh mục? (Nhật ký đã ghi không bị ảnh hưởng)')) return;
    await materialsStore.remove(b.dataset.matDel);
    nav();
  }));
};
