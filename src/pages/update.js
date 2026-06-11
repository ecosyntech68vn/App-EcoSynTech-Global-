// Feature I — OTA in-app update via GitHub Releases API
// V3.1 FIX #4: APK phải có file checksum .sha256 đi kèm trong release.
// App tải APK → tính SHA-256 (WebCrypto) → so khớp → mới cho lưu/cài.
// Checksum lệch hoặc thiếu = CHẶN. Loại bỏ vector cài APK bị thay thế/man-in-the-middle.
import { authStore } from '../stores/auth.js';
import { Filesystem, Directory } from '@capacitor/filesystem';

const CURRENT_VERSION = '4.0.0';

export async function renderUpdate() {
  return `
    <div class="app-header">📥 Cập nhật app
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('settings')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>
    <div class="card">
      <div class="card-title">Phiên bản hiện tại</div>
      <div class="metric">${CURRENT_VERSION}</div>
      <div class="card-meta">OTA có kiểm tra toàn vẹn SHA-256 — chỉ cài APK đúng checksum do EcoSynTech phát hành.</div>
    </div>
    <div class="form">
      <button id="check-update" class="btn">🔍 Kiểm tra cập nhật</button>
      <div id="update-status" style="margin-top:20px;"></div>
    </div>
  `;
}

async function sha256Hex(arrayBuffer) {
  const buf = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

window.wire_update = function() {
  document.getElementById('check-update')?.addEventListener('click', async () => {
    const btn = document.getElementById('check-update');
    btn.disabled = true; btn.textContent = 'Đang kiểm tra...';
    const out = document.getElementById('update-status');
    try {
      const repo = authStore.otaRepo || 'ecosyntech-global/farmos-mobile';
      const r = await fetch(`https://api.github.com/repos/${repo}/releases/latest`);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const release = await r.json();
      const latest = (release.tag_name || '').replace(/^v/, '');
      const apk = release.assets && release.assets.find(a => a.name.endsWith('.apk'));
      const shaAsset = release.assets && release.assets.find(a => a.name.endsWith('.apk.sha256'));
      if (!latest) {
        out.innerHTML = '<div class="empty"><p>Chưa có release nào.</p></div>';
      } else if (compareVer(latest, CURRENT_VERSION) > 0) {
        out.innerHTML = `
          <div class="card warn">
            <div class="card-title">📥 Có bản mới: v${escapeHtml(latest)}</div>
            <div class="card-meta">Hiện tại: v${CURRENT_VERSION}</div>
            <pre style="white-space:pre-wrap; font-size:12px; background:#f5f5f5; padding:8px; border-radius:6px; margin-top:10px;">${escapeHtml((release.body || '').slice(0, 500))}</pre>
            ${apk && shaAsset
              ? `<button id="dl-verify" class="btn" style="margin-top:10px; width:100%;">⬇ Tải + xác minh APK ${(apk.size/1024/1024).toFixed(1)}MB</button>
                 <div id="dl-progress" class="card-meta" style="margin-top:8px;"></div>`
              : `<div class="card crit" style="margin-top:10px;">
                   <div class="card-title">⛔ Không thể cập nhật an toàn</div>
                   <div class="card-meta">${!apk ? 'Release chưa có file APK.' : 'Release thiếu file checksum .apk.sha256 — từ chối tải để tránh APK giả mạo. Build pipeline phải đính kèm checksum.'}</div>
                 </div>`}
          </div>`;
        if (apk && shaAsset) wireDownload(apk, shaAsset, latest);
      } else {
        out.innerHTML = `
          <div class="card ok">
            <div class="card-title">✓ Đã là phiên bản mới nhất</div>
            <div class="card-meta">v${CURRENT_VERSION}</div>
          </div>`;
      }
    } catch (e) {
      out.innerHTML = `<div class="card crit"><div class="card-title">Lỗi kiểm tra</div><div class="card-meta">${escapeHtml(e.message)}</div></div>`;
    }
    btn.disabled = false; btn.textContent = '🔍 Kiểm tra cập nhật';
  });
};

function wireDownload(apk, shaAsset, version) {
  document.getElementById('dl-verify')?.addEventListener('click', async () => {
    const btn = document.getElementById('dl-verify');
    const prog = document.getElementById('dl-progress');
    btn.disabled = true;
    try {
      // 1. Lấy checksum công bố
      prog.textContent = '1/4 Lấy checksum...';
      const shaR = await fetch(shaAsset.browser_download_url);
      if (!shaR.ok) throw new Error('Không tải được checksum');
      const expected = (await shaR.text()).trim().split(/\s+/)[0].toLowerCase();
      if (!/^[a-f0-9]{64}$/.test(expected)) throw new Error('File checksum không hợp lệ');

      // 2. Tải APK
      prog.textContent = '2/4 Đang tải APK...';
      const apkR = await fetch(apk.browser_download_url);
      if (!apkR.ok) throw new Error('Không tải được APK');
      const buf = await apkR.arrayBuffer();

      // 3. Verify SHA-256
      prog.textContent = '3/4 Xác minh SHA-256...';
      const actual = await sha256Hex(buf);
      if (actual !== expected) {
        throw new Error(`CHECKSUM KHÔNG KHỚP — APK có thể đã bị thay thế. Đã hủy.\nExpected: ${expected.slice(0,16)}…\nActual: ${actual.slice(0,16)}…`);
      }

      // 4. Lưu file đã verify để user cài
      prog.textContent = '4/4 Lưu file đã xác minh...';
      const fileName = `farmos-v${version}-verified.apk`;
      await Filesystem.writeFile({
        path: fileName,
        data: arrayBufferToBase64(buf),
        directory: Directory.Documents
      });
      prog.innerHTML = `✅ <strong>Đã xác minh SHA-256 khớp.</strong><br/>File: Documents/${escapeHtml(fileName)}<br/>Mở app Files → chạm để cài đặt.`;
      window.showToast && window.showToast('✓ APK đã xác minh + lưu vào Documents', 'ok');
    } catch (e) {
      prog.innerHTML = `<span style="color:var(--c-crit,#c62828);">⛔ ${escapeHtml(e.message)}</span>`;
      window.showToast && window.showToast('Cập nhật bị chặn: ' + e.message, 'err');
    }
    btn.disabled = false;
  });
}

function compareVer(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}
function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
