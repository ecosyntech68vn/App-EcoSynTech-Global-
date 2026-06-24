import { aiDiagnosisStore } from '../stores/ai-diagnosis.js';

function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

export async function renderAiDiagnosis() {
  const diseases = aiDiagnosisStore.getSupportedDiseases();
  const loaded = aiDiagnosisStore.isModelLoaded();

  return `
    <div class="app-header">🤖 AI Chẩn đoán sâu bệnh
      <button onclick="document.querySelector('[x-data]').__x.\$data.nav('more')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>

    <div class="card" style="border:1px dashed var(--c-primary);">
      <div class="card-title">📸 Chụp ảnh cây trồng</div>
      <div class="card-meta">Chụp ảnh lá, thân hoặc quả có dấu hiệu bất thường. AI sẽ phân tích và đề xuất biện pháp xử lý.</div>
      <div style="display:flex;gap:6px;margin-top:10px;">
        <button id="ai-capture" class="btn primary" style="flex:1;">📷 Chụp ảnh</button>
        <button id="ai-gallery" class="btn secondary" style="flex:1;">🖼 Chọn từ thư viện</button>
      </div>
    </div>

    <div id="ai-result" style="display:none;"></div>

    <div class="card">
      <div class="card-title">🧠 Trạng thái AI</div>
      <div class="card-meta">
        Mô hình: <strong>${loaded ? '✅ Đã tải' : '⏳ Chưa tải'}</strong> · 
        ${diseases.length} bệnh hỗ trợ
      </div>
      <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;">
        ${diseases.map(d => `<span class="pill queued">${escapeHtml(d)}</span>`).join('')}
      </div>
    </div>

    <div class="card" style="text-align:center;border:1px dashed var(--c-border);">
      <div class="card-title">🔬 Công nghệ</div>
      <div class="card-meta">
        TensorFlow Lite · MobileNetV2 transfer learning<br/>
        Chạy hoàn toàn trên thiết bị — không cần internet sau khi tải mô hình<br/>
        <span style="font-size:11px;">Hiện đang ở chế độ mô phỏng (mock) — cần file .tflite để chạy thật</span>
      </div>
    </div>
  `;
}

window['wire_ai-diagnosis'] = function () {
  document.getElementById('ai-capture')?.addEventListener('click', async () => {
    const btn = document.getElementById('ai-capture');
    btn.disabled = true; btn.textContent = 'Đang xử lý...';
    try {
      const result = await aiDiagnosisStore.diagnose();
      showResult(result);
    } catch (e) { window.showToast?.('✗ ' + e.message, 'err'); }
    btn.disabled = false; btn.textContent = '📷 Chụp ảnh';
  });

  document.getElementById('ai-gallery')?.addEventListener('click', async () => {
    const btn = document.getElementById('ai-gallery');
    btn.disabled = true; btn.textContent = 'Đang xử lý...';
    try {
      const result = await aiDiagnosisStore.diagnose();
      showResult(result);
    } catch (e) { window.showToast?.('✗ ' + e.message, 'err'); }
    btn.disabled = false; btn.textContent = '🖼 Chọn từ thư viện';
  });
};

function showResult(result) {
  const el = document.getElementById('ai-result');
  el.style.display = '';
  el.innerHTML = `
    <div class="card ${result.healthy ? 'ok' : 'warn'}">
      <div class="card-title">${result.healthy ? '✅ Cây khỏe mạnh' : '⚠️ Phát hiện: ' + escapeHtml(result.disease)}</div>
      <div class="card-meta">Độ tin cậy: <strong>${(result.confidence * 100).toFixed(0)}%</strong> · Phương pháp: ${escapeHtml(result.method)}</div>
      ${result.advisories && result.advisories.length ? result.advisories.map(a => `
        <div style="margin-top:8px;padding:8px;background:var(--c-bg);border-radius:6px;">
          <strong style="font-size:12px;color:${a.type === 'chemical' ? 'var(--c-crit)' : 'var(--c-ok)'};">${a.type === 'chemical' ? '🧪 Hóa học' : '🌿 Hữu cơ'}:</strong>
          <p style="margin:4px 0 0;font-size:13px;">${escapeHtml(a.text)}</p>
        </div>`) : ''}
      <div class="card-meta" style="margin-top:8px;">⏱ ${new Date(result.timestamp).toLocaleString('vi-VN')}</div>
    </div>
  `;
}
