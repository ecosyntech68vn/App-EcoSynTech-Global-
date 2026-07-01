// Feature P — Pest/disease log với severity scale
// V4.1 — 🤖 AI chẩn đoán sâu bệnh từ ảnh (beta): POST /api/ai/disease-classify (WLC V6.1).
// Offline → báo cần kết nối, ảnh vẫn lưu vào báo cáo như cũ. AI là tham khảo, không thay người.
import { fallbackFetch } from '../api/fallback-client.js';
import { syncQueue } from '../stores/sync.js';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { requestPhotoPermission, showPermissionGuide } from '../lib/camera-permission.js';

export async function renderPest() {
  return `
    <div class="app-header">🐛 Ghi sâu bệnh
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('dashboard')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>
    <form id="pest-form" class="form">
      <label>Zone</label>
      <input name="zoneId" required placeholder="Z01" />

      <label>Loại sâu/bệnh</label>
      <input name="kind" required placeholder="VD: Sâu xanh, Đốm lá" />

      <label>Mức độ (1-5)</label>
      <select name="severity" required>
        <option value="1">1 - Nhẹ (vài lá)</option>
        <option value="2">2 - Trung bình</option>
        <option value="3" selected>3 - Đáng kể</option>
        <option value="4">4 - Nặng (lan rộng)</option>
        <option value="5">5 - Khẩn cấp</option>
      </select>

      <label>Mô tả</label>
      <textarea name="description" placeholder="Triệu chứng cụ thể..."></textarea>

      <label>Ảnh</label>
      <div style="display:flex; gap:10px;">
        <button type="button" id="pest-photo" class="btn secondary" style="flex:1;">📷 Chụp</button>
        <div id="pest-preview" style="width:60px; height:60px; border:1px dashed var(--c-border); border-radius:8px; background:#f5f5f5; display:flex; align-items:center; justify-content:center;">-</div>
      </div>
      <input type="hidden" name="photoPath" />

      <button type="button" id="ai-diagnose" class="btn secondary" style="margin-top:10px; width:100%;" disabled>🤖 AI chẩn đoán từ ảnh (beta)</button>
      <div id="ai-result" style="margin-top:8px;"></div>

      <label>Hành động đề xuất</label>
      <select name="action">
        <option value="monitor">Theo dõi tiếp</option>
        <option value="biological">Xử lý sinh học</option>
        <option value="physical">Xử lý vật lý</option>
        <option value="chemical">Dùng thuốc</option>
        <option value="escalate">Báo tech</option>
      </select>

      <div style="margin-top:18px;">
        <button type="submit" class="btn">Lưu báo cáo</button>
      </div>
    </form>
  `;
}

function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// Đọc ảnh từ webPath → base64 (resize đã làm ở Camera width:1280, quality:70)
async function photoToBase64(uri) {
  const r = await fetch(uri);
  const blob = await r.blob();
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result); // data:image/...;base64,xxx
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
}

window.wire_pest = function() {
  let photoUri = '';
  let aiResult = null;

  document.getElementById('pest-photo')?.addEventListener('click', async () => {
    // Kiểm tra quyền camera trước
    const pPerm = await requestPhotoPermission();
    if (!pPerm.granted) { showPermissionGuide('photo'); return; }
    try {
      const p = await Camera.getPhoto({
        quality: 70, resultType: CameraResultType.Uri,
        source: CameraSource.Camera, width: 1280
      });
      photoUri = p.webPath || p.path;
      document.querySelector('input[name=photoPath]').value = photoUri || '';
      const prev = document.getElementById('pest-preview');
      if (prev && photoUri) prev.innerHTML = `<img src="${photoUri}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" />`;
      const aiBtn = document.getElementById('ai-diagnose');
      if (aiBtn) aiBtn.disabled = false;
    } catch (e) {
      window.showToast && window.showToast('Không chụp được', 'err');
    }
  });

  // V4.1 — AI chẩn đoán (beta)
  document.getElementById('ai-diagnose')?.addEventListener('click', async () => {
    if (!photoUri) { window.showToast?.('Chụp ảnh trước đã', 'err'); return; }
    const btn = document.getElementById('ai-diagnose');
    const out = document.getElementById('ai-result');
    btn.disabled = true; btn.textContent = '🤖 Đang phân tích...';
    try {
      const imageBase64 = await photoToBase64(photoUri);
      const zoneId = document.querySelector('#pest-form [name=zoneId]')?.value || null;
      const r = await fallbackFetch('/api/ai/disease-classify', {
        method: 'POST',
        body: JSON.stringify({ imageBase64, zoneId })
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      if (!d.ok || !d.data) throw new Error(d.error || 'AI không trả kết quả');
      aiResult = d.data;
      const name = aiResult.labelVi || aiResult.disease || 'Không rõ';
      out.innerHTML = `
        <div class="card ${aiResult.healthy ? 'ok' : 'warn'}" style="margin:0;">
          <div class="card-title" style="font-size:14px;">${aiResult.healthy ? '✅' : '⚠️'} ${escapeHtml(name)}</div>
          <div class="card-meta">Độ tin cậy: ${escapeHtml(aiResult.confidence || '-')} · ${escapeHtml(aiResult.method || '')} (beta)</div>
          ${aiResult.advisory ? `<p style="margin:6px 0 0; font-size:13px;">${escapeHtml(aiResult.advisory)}</p>` : ''}
        </div>`;
      // Tự điền loại bệnh nếu user chưa gõ
      const kindEl = document.querySelector('#pest-form [name=kind]');
      if (kindEl && !kindEl.value && !aiResult.healthy) kindEl.value = name;
      window.showToast?.('✓ AI phân tích xong — kiểm chứng thực tế trước khi xử lý', 'ok');
    } catch (e) {
      out.innerHTML = `<div class="card-meta" style="color:#c62828;">🤖 AI cần kết nối bộ điều khiển/cloud (${escapeHtml(e.message)}). Ảnh vẫn lưu vào báo cáo — chẩn đoán lại khi online.</div>`;
    }
    btn.disabled = false; btn.textContent = '🤖 AI chẩn đoán từ ảnh (beta)';
  });

  document.getElementById('pest-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      activity: 'pest',
      zoneId: fd.get('zoneId'),
      kind: fd.get('kind'),
      severity: parseInt(fd.get('severity')),
      description: fd.get('description'),
      action: fd.get('action'),
      photoPath: fd.get('photoPath') || null,
      aiDiagnosis: aiResult ? { disease: aiResult.disease, labelVi: aiResult.labelVi, confidence: aiResult.confidence, method: aiResult.method } : null,
      ts: Date.now()
    };
    try {
      const r = await fallbackFetch('/api/journal/manual', { method: 'POST', body: JSON.stringify(payload) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      window.showToast && window.showToast('✓ Đã lưu báo cáo', 'ok');
    } catch (err) {
      await syncQueue.enqueue({ path: '/api/journal/manual', method: 'POST', body: JSON.stringify(payload) });
      window.showToast && window.showToast('⏳ Queue offline', '');
    }
    e.target.reset();
    document.querySelector('[x-data]').__x.$data.nav('dashboard');
  });
};
