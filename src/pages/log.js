// Operation Log V5 — nhật ký vận hành CHUẨN HOÁ theo VietGAP/GlobalGAP/EU.
// V5: chọn lô → tự bung hồ sơ lô đã khai (zone/cây/PUC/chuẩn), KHÔNG gõ tay zone.
//     Field ghi sự kiện chuẩn hoá theo từng hoạt động (tưới/bón/BVTV/thu hoạch).
// Giữ: ảnh + GPS stamp + offline queue + gắn chuỗi truy xuất append-only + khoá PHI.
import { fallbackFetch } from '../api/fallback-client.js';
import { syncQueue } from '../stores/sync.js';
import { lotStore, materialsStore } from '../db/trace.js';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { get, set } from 'idb-keyval';

const RECENT_KEY = 'cache:log:recent';

let lastKnownGPS = null;
async function captureGPS() {
  try {
    const perm = await Geolocation.checkPermissions();
    if (perm.location !== 'granted') {
      const req = await Geolocation.requestPermissions();
      if (req.location !== 'granted') return null;
    }
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 });
    lastKnownGPS = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy, ts: pos.timestamp };
    return lastKnownGPS;
  } catch (e) {
    return lastKnownGPS;
  }
}

export async function renderLog() {
  const recent = (await get(RECENT_KEY)) || [];
  const queued = await syncQueue.size();
  const lots = (await lotStore.list()).filter(l => l.status === 'growing');
  return `
    <div class="app-header">📝 Nhật ký vận hành</div>
    <form id="log-form" class="form">
      <label>Lô truy xuất (chọn để tự bung hồ sơ lô)</label>
      <select name="lotId" id="log-lot">
        <option value="">— Không gắn lô (ghi tự do) —</option>
        ${lots.map(l => `<option value="${escapeHtml(l.id)}">${escapeHtml(l.code)} · ${escapeHtml(l.crop)}${l.zoneId ? ' · ' + escapeHtml(l.zoneId) : ''}</option>`).join('')}
      </select>

      <div id="lot-info" style="display:none; background:#E8F5E9; border:1px solid #C8E6C9; border-radius:8px; padding:10px; margin:6px 0; font-size:13px;"></div>

      <label>Hoạt động</label>
      <select name="activity" id="log-activity" required>
        <option value="irrigation">💧 Tưới nước</option>
        <option value="fertilizer">🌱 Bón phân</option>
        <option value="pest">🐛 Xử lý sâu/bệnh (BVTV)</option>
        <option value="weeding">✂️ Làm cỏ / chăm sóc</option>
        <option value="inspection">🔍 Kiểm tra đồng ruộng</option>
        <option value="harvest">🌾 Thu hoạch</option>
        <option value="other">Khác</option>
      </select>

      <div id="zone-row">
        <label>Zone / khu vực</label>
        <input name="zoneId" id="log-zone" type="text" placeholder="Z1, Z2, …" />
      </div>

      <label>Người thực hiện</label>
      <input name="operator" placeholder="Tên người làm (truy xuất trách nhiệm)" />

      <!-- ===== Field chuẩn hoá theo hoạt động ===== -->
      <div class="actfields" data-act="irrigation" style="display:none;">
        <label>Nguồn nước</label>
        <select name="waterSource">
          <option value="">— Chọn —</option>
          <option>Giếng khoan</option><option>Sông/suối</option><option>Ao/hồ</option>
          <option>Nước máy</option><option>Nước mưa thu gom</option>
        </select>
        <label>Lượng nước</label>
        <div style="display:flex; gap:8px;">
          <input name="waterQty" type="number" step="0.1" placeholder="VD: 20" style="flex:2;" />
          <select name="waterUnit" style="flex:1;"><option>m³</option><option>lít</option><option>giờ</option></select>
        </div>
        <label>Phương pháp tưới</label>
        <select name="irrMethod"><option value="">—</option><option>Nhỏ giọt</option><option>Phun mưa</option><option>Tưới tràn</option><option>Tưới tay</option></select>
      </div>

      <div class="actfields" data-act="fertilizer" style="display:none;">
        <label>Loại phân</label>
        <select name="fertType"><option value="">—</option><option>Hữu cơ</option><option>Vô cơ (NPK)</option><option>Vi sinh</option><option>Phân bón lá</option></select>
        <label>Tên / công thức (NPK)</label>
        <input name="fertName" placeholder="VD: NPK 16-16-8, phân bò ủ hoai" />
        <label>Liều lượng</label>
        <div style="display:flex; gap:8px;">
          <input name="dose" type="number" step="0.1" placeholder="VD: 25" style="flex:2;" />
          <input name="doseUnit" placeholder="kg/sào, kg/ha, g/m²" style="flex:3;" />
        </div>
        <label>Cách bón</label>
        <select name="fertMethod"><option value="">—</option><option>Bón gốc</option><option>Bón lá</option><option>Hoà tưới</option></select>
      </div>

      <div class="actfields" data-act="pest" style="display:none;">
        <label>Vật tư BVTV (chọn để auto hoạt chất + PHI)</label>
        <select name="materialId" id="log-material"><option value="">— Chọn thuốc —</option></select>
        <div id="log-phi-warn" class="card-meta" style="color:#c62828;"></div>
        <label>Đối tượng phòng trừ</label>
        <input name="target" placeholder="VD: sâu tơ, bệnh sương mai, cỏ lồng vực" />
        <label>Liều lượng</label>
        <div style="display:flex; gap:8px;">
          <input name="dose" type="number" step="0.1" placeholder="VD: 20" style="flex:2;" />
          <input name="doseUnit" placeholder="ml/10L, g/bình, L/ha" style="flex:3;" />
        </div>
        <label>Dụng cụ phun</label>
        <input name="equipment" placeholder="VD: bình phun 16L, máy phun" />
        <label>Thời tiết khi phun</label>
        <input name="weather" placeholder="VD: nắng nhẹ, gió yếu, không mưa" />
      </div>

      <div class="actfields" data-act="harvest" style="display:none;">
        <label>Sản lượng</label>
        <div style="display:flex; gap:8px;">
          <input name="harvestQty" type="number" step="0.1" placeholder="VD: 150" style="flex:2;" />
          <select name="harvestUnit" style="flex:1;"><option>kg</option><option>tấn</option><option>thùng</option><option>bó</option></select>
        </div>
        <label>Quy cách đóng gói</label>
        <input name="packing" placeholder="VD: túi 1kg, thùng 10kg" />
        <label>Số lô đóng gói (batch/lot GS1)</label>
        <input name="packLot" placeholder="VD: PK-20260616-01" />
      </div>

      <label>Ghi chú</label>
      <textarea name="note" placeholder="Mô tả chi tiết..."></textarea>

      <label>Ảnh (tuỳ chọn — bằng chứng truy xuất)</label>
      <div style="display:flex; gap:10px;">
        <button type="button" id="take-photo" class="btn secondary" style="flex:1;">📷 Chụp ảnh</button>
        <div id="photo-preview" style="width:60px; height:60px; border:1px dashed var(--c-border); border-radius:8px; background:#f5f5f5; display:flex; align-items:center; justify-content:center; font-size:24px; color:var(--c-text-muted);">-</div>
      </div>
      <input type="hidden" name="photoPath" />

      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
        <input type="checkbox" name="captureGps" checked />
        <span>📍 Ghi tọa độ GPS</span>
      </label>

      <div style="margin-top:18px;"><button type="submit" class="btn">Lưu nhật ký</button></div>
      <p style="text-align:center; margin-top:10px; font-size:12px; color:var(--c-text-muted);">
        ${queued > 0 ? `⏳ ${queued} entry chờ sync` : '✓ Đã sync hết'}
      </p>
    </form>

    <h3 style="padding:0 16px; margin-top:20px; color:var(--c-text-muted); font-size:13px; text-transform:uppercase;">Gần đây</h3>
    <div id="log-recent">
      ${recent.length === 0
        ? `<div class="empty" style="padding:20px;"><p>Chưa có nhật ký.</p></div>`
        : recent.map(r => `
          <div class="card">
            <div class="row">
              <div class="card-title">${escapeHtml(ACT_LBL[r.activity] || r.activity)}${r.lotCode ? ' · ' + escapeHtml(r.lotCode) : (r.zoneId ? ' · Zone ' + escapeHtml(r.zoneId) : '')}</div>
              <span class="pill ${r.synced ? 'completed' : 'pending-sync'}">${r.synced ? 'Synced' : 'Pending'}</span>
            </div>
            <div class="card-meta">${escapeHtml(new Date(r.ts).toLocaleString('vi-VN'))}${r.operator ? ' · ' + escapeHtml(r.operator) : ''}</div>
            ${r.note ? `<p style="margin:6px 0 0; font-size:13px;">${escapeHtml(r.note)}</p>` : ''}
            ${r.gps && r.gps.lat ? `<div class="card-meta" style="margin-top:4px;">📍 ${Number(r.gps.lat).toFixed(5)}, ${Number(r.gps.lng).toFixed(5)}</div>` : ''}
          </div>
        `).join('')}
    </div>
  `;
}

const ACT_LBL = { irrigation:'💧 Tưới nước', fertilizer:'🌱 Bón phân', pest:'🐛 Xử lý BVTV', weeding:'✂️ Làm cỏ', inspection:'🔍 Kiểm tra', harvest:'🌾 Thu hoạch', other:'Khác' };

function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// Gom field chuẩn hoá theo hoạt động thành object `fields` (lưu vào sự kiện truy xuất).
function collectFields(fd, activity) {
  const f = { operator: fd.get('operator') || '' };
  if (activity === 'irrigation') Object.assign(f, { waterSource: fd.get('waterSource'), waterQty: fd.get('waterQty'), waterUnit: fd.get('waterUnit'), method: fd.get('irrMethod') });
  else if (activity === 'fertilizer') Object.assign(f, { fertType: fd.get('fertType'), fertName: fd.get('fertName'), method: fd.get('fertMethod') });
  else if (activity === 'pest') Object.assign(f, { target: fd.get('target'), equipment: fd.get('equipment'), weather: fd.get('weather') });
  else if (activity === 'harvest') Object.assign(f, { packing: fd.get('packing'), packLot: fd.get('packLot') });
  // loại field rỗng
  Object.keys(f).forEach(k => { if (f[k] == null || f[k] === '') delete f[k]; });
  return f;
}

window.wire_log = function() {
  const lotSel = document.getElementById('log-lot');
  const zoneInput = document.getElementById('log-zone');
  const zoneRow = document.getElementById('zone-row');
  const lotInfo = document.getElementById('lot-info');
  const actSel = document.getElementById('log-activity');

  // ===== Chọn lô → tự bung hồ sơ + điền Zone (khoá) =====
  async function onLotChange() {
    const id = lotSel.value;
    if (!id) {
      lotInfo.style.display = 'none';
      zoneInput.readOnly = false; zoneInput.value = ''; zoneRow.style.display = '';
      return;
    }
    const lot = await lotStore.byId(id);
    if (!lot) return;
    zoneInput.value = lot.zoneId || '';
    zoneInput.readOnly = true;               // lấy từ lô, không gõ tay
    zoneRow.style.display = lot.zoneId ? 'none' : '';  // có zone trong lô thì ẩn ô
    const t = lot.trace || {};
    const std = (t.standards || []).map(s => `<span class="pill completed" style="margin-right:3px;">${escapeHtml(s)}</span>`).join('');
    lotInfo.style.display = 'block';
    lotInfo.innerHTML = `
      <div><strong>${escapeHtml(lot.code)}</strong> · ${escapeHtml(lot.crop)}${lot.variety ? ' (' + escapeHtml(lot.variety) + ')' : ''}${lot.zoneId ? ' · Zone ' + escapeHtml(lot.zoneId) : ''}${lot.area ? ' · ' + escapeHtml(lot.area) : ''}</div>
      ${std ? `<div style="margin-top:4px;">${std}</div>` : ''}
      ${t.puc ? `<div style="margin-top:2px;">Mã vùng trồng: <strong>${escapeHtml(t.puc)}</strong></div>` : ''}
      ${t.market ? `<div>Thị trường: ${escapeHtml(t.market)}</div>` : ''}
      ${t.producer ? `<div>Cơ sở: ${escapeHtml(t.producer)}</div>` : ''}
      <div style="margin-top:4px; color:#2E7D32;">↳ Ghi sự kiện này vào chuỗi truy xuất của lô (append-only).</div>`;
  }
  lotSel?.addEventListener('change', onLotChange);

  // ===== Đổi hoạt động → hiện field chuẩn hoá tương ứng =====
  async function onActChange() {
    const act = actSel.value;
    document.querySelectorAll('.actfields').forEach(el => { el.style.display = el.dataset.act === act ? 'block' : 'none'; });
    if (act === 'pest') {
      const matSel = document.getElementById('log-material');
      if (matSel && matSel.options.length <= 1) {
        const mats = await materialsStore.list();
        matSel.innerHTML = `<option value="">— Chọn thuốc —</option>` +
          mats.filter(m => m.type === 'pesticide' || m.type === 'other').map(m => `<option value="${m.id}">${escapeHtml(m.name)}${m.phiDays > 0 ? ` (PHI ${m.phiDays}d)` : ''}</option>`).join('');
      }
    }
  }
  actSel?.addEventListener('change', onActChange);
  onActChange();

  document.getElementById('log-material')?.addEventListener('change', async (e) => {
    const m = await materialsStore.byId(e.target.value);
    const w = document.getElementById('log-phi-warn');
    if (w) w.textContent = m && m.phiDays > 0 ? `⚠ Thuốc có thời gian cách ly ${m.phiDays} ngày — lô sẽ bị khoá thu hoạch tương ứng.` : '';
  });

  // ===== Ảnh =====
  let lastPhotoUri = null;
  document.getElementById('take-photo')?.addEventListener('click', async () => {
    try {
      const photo = await Camera.getPhoto({ quality: 70, allowEditing: false, resultType: CameraResultType.Uri, source: CameraSource.Camera, width: 1280 });
      lastPhotoUri = photo.webPath || photo.path;
      document.querySelector('input[name=photoPath]').value = lastPhotoUri || '';
      const preview = document.getElementById('photo-preview');
      if (preview && lastPhotoUri) preview.innerHTML = `<img src="${lastPhotoUri}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" />`;
    } catch (e) { window.showToast && window.showToast('Không thể chụp ảnh: ' + e.message, 'err'); }
  });

  // ===== Submit =====
  document.getElementById('log-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Đang lưu...';
    const activity = fd.get('activity');
    const gps = fd.get('captureGps') ? await captureGPS() : null;
    const lotId = fd.get('lotId') || null;
    const fields = collectFields(fd, activity);
    const dose = fd.get('dose') || null, doseUnit = fd.get('doseUnit') || null;
    const payload = {
      activity, zoneId: fd.get('zoneId'), operator: fields.operator || '', note: fd.get('note'),
      lotId, fields, dose, doseUnit, photoPath: fd.get('photoPath') || null, gps, ts: Date.now()
    };

    if (lotId) {
      try {
        const { phiApplied } = await lotStore.recordActivity(lotId, {
          type: activity, materialId: fd.get('materialId') || null,
          dose, doseUnit, note: fd.get('note'), fields,
          gps: payload.gps, photoPath: payload.photoPath, ts: payload.ts
        });
        const lot = await lotStore.byId(lotId);
        await pushRecent({ ...payload, lotCode: lot?.code, synced: false });
        window.showToast && window.showToast(phiApplied ? `✓ Đã ghi vào lô. 🔒 Khoá PHI ${phiApplied.phiDays} ngày` : '✓ Đã ghi vào lô truy xuất', 'ok');
      } catch (err) {
        window.showToast && window.showToast('✗ ' + err.message, 'err');
        btn.disabled = false; btn.textContent = 'Lưu nhật ký'; return;
      }
    } else {
      try {
        const r = await fallbackFetch('/api/journal/manual', { method: 'POST', body: JSON.stringify(payload) });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        window.showToast && window.showToast('✓ Đã lưu nhật ký', 'ok');
        await pushRecent({ ...payload, synced: true });
      } catch (err) {
        await syncQueue.enqueue({ path: '/api/journal/manual', method: 'POST', body: JSON.stringify(payload) });
        await pushRecent({ ...payload, synced: false });
        window.showToast && window.showToast('⏳ Queue offline — sẽ sync sau', '');
      }
    }
    e.target.reset();
    btn.disabled = false; btn.textContent = 'Lưu nhật ký';
    document.querySelector('[x-data]').__x.$data.nav('log');
  });
};

async function pushRecent(item) {
  const cur = (await get(RECENT_KEY)) || [];
  cur.unshift(item);
  await set(RECENT_KEY, cur.slice(0, 50));
}
