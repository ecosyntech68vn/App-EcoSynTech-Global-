// Operation Log V3.1 — form + photo + GPS stamp + offline queue
// V3.1: gắn nhật ký vào LÔ truy xuất (tuỳ chọn) — ghi vào chuỗi sự kiện append-only của lô,
// tự động kích hoạt khoá PHI nếu hoạt động là BVTV có vật tư cách ly.
import { fallbackFetch } from '../api/fallback-client.js';
import { syncQueue } from '../stores/sync.js';
import { lotStore } from '../db/trace.js';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
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
      <label>Hoạt động</label>
      <select name="activity" required>
        <option value="irrigation">Tưới nước</option>
        <option value="fertilizer">Bón phân</option>
        <option value="pest">Xử lý sâu/bệnh</option>
        <option value="harvest">Thu hoạch</option>
        <option value="other">Khác</option>
      </select>

      <label>Lô truy xuất (khuyến nghị chọn)</label>
      <select name="lotId">
        <option value="">— Không gắn lô —</option>
        ${lots.map(l => `<option value="${escapeHtml(l.id)}">${escapeHtml(l.code)} · ${escapeHtml(l.crop)}</option>`).join('')}
      </select>

      <label>Zone</label>
      <input name="zoneId" type="text" placeholder="Z1, Z2, …" required />

      <label>Ghi chú</label>
      <textarea name="note" placeholder="Mô tả chi tiết..."></textarea>

      <label>Ảnh (tuỳ chọn)</label>
      <div style="display:flex; gap:10px;">
        <button type="button" id="take-photo" class="btn secondary" style="flex:1;">📷 Chụp ảnh</button>
        <div id="photo-preview" style="width:60px; height:60px; border:1px dashed var(--c-border); border-radius:8px; background:#f5f5f5; display:flex; align-items:center; justify-content:center; font-size:24px; color:var(--c-text-muted);">-</div>
      </div>

      <input type="hidden" name="photoPath" />

      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
        <input type="checkbox" name="captureGps" checked />
        <span>📍 Ghi tọa độ GPS</span>
      </label>

      <div style="margin-top:18px;">
        <button type="submit" class="btn">Lưu nhật ký</button>
      </div>
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
              <div class="card-title">${escapeHtml(r.activity)} · Zone ${escapeHtml(r.zoneId)}</div>
              <span class="pill ${r.synced ? 'completed' : 'pending-sync'}">${r.synced ? 'Synced' : 'Pending'}</span>
            </div>
            <div class="card-meta">${escapeHtml(new Date(r.ts).toLocaleString('vi-VN'))}</div>
            ${r.note ? `<p style="margin:6px 0 0; font-size:13px;">${escapeHtml(r.note)}</p>` : ''}
            ${r.gps && r.gps.lat ? `<div class="card-meta" style="margin-top:4px;">📍 ${Number(r.gps.lat).toFixed(5)}, ${Number(r.gps.lng).toFixed(5)}</div>` : ''}
          </div>
        `).join('')}
    </div>
  `;
}

function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

window.wire_log = function() {
  let lastPhotoUri = null;
  document.getElementById('take-photo')?.addEventListener('click', async () => {
    try {
      const photo = await Camera.getPhoto({
        quality: 70, allowEditing: false,
        resultType: CameraResultType.Uri, source: CameraSource.Camera, width: 1280
      });
      lastPhotoUri = photo.webPath || photo.path;
      document.querySelector('input[name=photoPath]').value = lastPhotoUri || '';
      const preview = document.getElementById('photo-preview');
      if (preview && lastPhotoUri) {
        preview.innerHTML = `<img src="${lastPhotoUri}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" />`;
      }
    } catch (e) {
      window.showToast && window.showToast('Không thể chụp ảnh: ' + e.message, 'err');
    }
  });

  document.getElementById('log-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Đang lưu...';
    const captureGps = fd.get('captureGps') ? true : false;
    const gps = captureGps ? await captureGPS() : null;
    const lotId = fd.get('lotId') || null;
    const payload = {
      activity: fd.get('activity'),
      zoneId: fd.get('zoneId'),
      note: fd.get('note'),
      lotId: lotId,
      photoPath: fd.get('photoPath') || null,
      gps: gps,
      ts: Date.now()
    };
    // V3.1 — nếu gắn lô: ghi vào chuỗi truy xuất append-only (kèm queue sync sẵn trong recordActivity)
    if (lotId) {
      try {
        const { phiApplied } = await lotStore.recordActivity(lotId, {
          type: payload.activity, note: payload.note,
          gps: payload.gps, photoPath: payload.photoPath, ts: payload.ts
        });
        await pushRecent({ ...payload, synced: false });
        window.showToast && window.showToast(phiApplied ? `✓ Đã ghi vào lô. 🔒 Khoá PHI ${phiApplied.phiDays} ngày` : '✓ Đã ghi vào lô truy xuất', 'ok');
        e.target.reset();
        btn.disabled = false; btn.textContent = 'Lưu nhật ký';
        document.querySelector('[x-data]').__x.$data.nav('log');
        return;
      } catch (err) {
        window.showToast && window.showToast('✗ ' + err.message, 'err');
        btn.disabled = false; btn.textContent = 'Lưu nhật ký';
        return;
      }
    }
    try {
      const r = await fallbackFetch('/api/journal/manual', {
        method: 'POST', body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      window.showToast && window.showToast('✓ Đã lưu nhật ký', 'ok');
      await pushRecent({ ...payload, synced: true });
    } catch (err) {
      await syncQueue.enqueue({ path: '/api/journal/manual', method: 'POST', body: JSON.stringify(payload) });
      await pushRecent({ ...payload, synced: false });
      window.showToast && window.showToast('⏳ Queue offline — sẽ sync sau', '');
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
