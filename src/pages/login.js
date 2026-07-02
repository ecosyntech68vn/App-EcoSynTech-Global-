// Login page — PIN 4-digit + URL config + test connection
// V3.0.1 — Local mode default, first-run banner, URL only required when mode!=local
import { authStore } from '../stores/auth.js';

function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

export async function renderLogin() {
  // Load last URL from preferences
  const lastUrl = authStore.url || '';
  const currentMode = authStore.mode || 'local';
  const seeded = await authStore.isDefaultPinSeeded();
  // First-run banner only when PIN not yet changed by user (i.e. still default)
  const firstRunBanner = seeded
    ? `<div class="banner-info" style="background:#FFF8E1;border:1px solid #FBC02D;color:#5D4037;padding:10px 12px;border-radius:8px;margin-bottom:14px;font-size:13px;line-height:1.45;">
         💡 <strong>Lần đầu sử dụng?</strong> PIN mặc định: <strong>1234</strong>. Chế độ <strong>Local (Offline)</strong> không cần server. Đổi PIN trong Settings sau khi vào.
       </div>`
    : '';
  return `
  <div class="login-wrap">
    <div class="logo">🌱 EcoSynTech</div>
    <div class="tagline">Farm OS · Phiên bản 4.0.0</div>

    <div class="login-card">
      ${firstRunBanner}
      <form id="login-form">
        <label>Chế độ mạng</label>
        <select name="mode" id="login-mode">
          <option value="local" ${currentMode==='local'?'selected':''}>Local (Offline) — khuyến nghị lần đầu</option>
          <option value="lan" ${currentMode==='lan'?'selected':''}>LAN (WLC)</option>
          <option value="cloud" ${currentMode==='cloud'?'selected':''}>Cloud (GAS)</option>
          <option value="auto" ${currentMode==='auto'?'selected':''}>Auto (LAN → fallback Cloud)</option>
        </select>

        <div id="url-row" style="${currentMode==='local'?'display:none;':''}">
          <label>Server URL (chỉ khi không phải Local)</label>
          <input name="url" type="url" value="${escapeHtml(lastUrl)}"
                 placeholder="http://192.168.1.100:3000" />
        </div>

        <label>PIN 4-6 số</label>
        <input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4,6}"
               maxlength="6" required autocomplete="off" />

        <div style="margin-top:18px;">
          <button type="submit" class="btn">Đăng nhập</button>
        </div>
        <div style="margin-top:10px;">
          <button type="button" class="btn secondary" id="test-conn">Test kết nối</button>
        </div>
        <p style="margin-top:14px; font-size:12px; color:var(--c-text-muted); text-align:center;">
          v7.0.2 · NFC · Voice · CHợ HTX · Carbon Credits · IoT ESP32
        </p>
      </form>
    </div>
  </div>
  <script>
    // Toggle URL row visibility based on mode (Local hides URL)
    document.getElementById('login-mode')?.addEventListener('change', (e) => {
      const row = document.getElementById('url-row');
      if (row) row.style.display = (e.target.value === 'local') ? 'none' : '';
    });
    document.getElementById('test-conn')?.addEventListener('click', async () => {
      const mode = document.getElementById('login-mode').value;
      if (mode === 'local') {
        window.showToast?.('✓ Local mode — không cần server', 'ok');
        return;
      }
      const urlEl = document.querySelector('input[name=url]');
      const url = urlEl ? urlEl.value.trim() : '';
      if (!url) { window.showToast?.('Nhập URL trước khi test', 'err'); return; }
      const btn = document.getElementById('test-conn');
      btn.disabled = true; btn.textContent = 'Đang test...';
      try {
        const r = await fetch(url.replace(/\\/$/,'') + '/api/health');
        if (r.ok) { window.showToast?.('✓ Kết nối OK', 'ok'); }
        else { window.showToast?.('✗ HTTP ' + r.status, 'err'); }
      } catch (e) { window.showToast?.('✗ ' + e.message, 'err'); }
      finally { btn.disabled = false; btn.textContent = 'Test kết nối'; }
    });
  </script>
  `;
}
