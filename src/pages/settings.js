// Settings — URL, mode, sync interval, storage, logout
// V3.1: dead-letter UI (FIX #5) + validate URL TLS policy (FIX #3) + push config xuống bg runner (FIX #6)
import { authStore, validateServerUrl } from '../stores/auth.js';
import { syncQueue } from '../stores/sync.js';
import { bgsync } from '../stores/bgsync.js';
import { PLANS } from '../stores/plan.js';
import { demoData } from '../db/demo.js';
import { Filesystem, Directory } from '@capacitor/filesystem';

export async function renderSettings() {
  const queueSize = await syncQueue.size();
  const deadSize = await syncQueue.deadSize();
  return `
    <div class="app-header">⚙️ Cài đặt</div>
    <div class="form">
      <label>Server URL (LAN WLC)</label>
      <input id="set-url" type="url" value="${escapeHtml(authStore.url || '')}" />
      <div style="margin-top:6px;">
        <button id="test-server" class="btn secondary" style="width:auto; padding:6px 12px;">Test</button>
      </div>

      <label>Cloud URL (GAS Web App)</label>
      <input id="set-cloud" type="url" value="${escapeHtml(authStore.cloudUrl || '')}" placeholder="https://script.google.com/macros/s/.../exec" />

      <label>Chế độ mạng</label>
      <select id="set-mode">
        <option value="local" ${authStore.mode==='local'?'selected':''}>Local (offline, không server)</option>
        <option value="lan" ${authStore.mode==='lan'?'selected':''}>LAN only</option>
        <option value="cloud" ${authStore.mode==='cloud'?'selected':''}>Cloud only</option>
        <option value="auto" ${authStore.mode==='auto'?'selected':''}>Auto (LAN → Cloud)</option>
      </select>

      <div style="margin-top:18px;">
        <button id="save-settings" class="btn">Lưu cài đặt</button>
      </div>

      <hr style="margin:24px 0; border:0; border-top:1px solid var(--c-border);" />

      <h3 style="margin:0 0 10px; font-size:14px;">Bộ nhớ + Sync</h3>
      <div class="card-meta">Queue chờ sync: <strong>${queueSize}</strong></div>
      <div style="margin-top:10px; display:flex; gap:8px;">
        <button id="force-sync" class="btn secondary" style="flex:1;">↻ Sync ngay</button>
        <button id="clear-queue" class="btn danger" style="flex:1;">Xoá queue</button>
      </div>

      ${deadSize > 0 ? `
      <div class="card crit" style="margin-top:12px;">
        <div class="card-title">⚠ Sync lỗi (dead-letter): ${deadSize} bản ghi</div>
        <div class="card-meta">Server từ chối các bản ghi này. Dữ liệu KHÔNG mất — retry sau khi sửa nguyên nhân, hoặc xuất JSON giữ bằng chứng.</div>
        <div id="dead-list" style="margin-top:8px;"></div>
        <div style="margin-top:10px; display:flex; gap:8px;">
          <button id="dead-retry-all" class="btn secondary" style="flex:1;">↻ Retry tất cả</button>
          <button id="dead-export" class="btn secondary" style="flex:1;">⬇ Xuất JSON</button>
        </div>
      </div>` : ''}

      <hr style="margin:24px 0; border:0; border-top:1px solid var(--c-border);" />

      <h3 style="margin:0 0 10px; font-size:14px;">Gói dịch vụ</h3>
      <select id="set-plan">
        ${Object.entries(PLANS).map(([k, p]) => `<option value="${k}" ${authStore.plan===k?'selected':''}>${p.label} · ${p.priceOnce}${p.sub?' · '+p.sub:''}</option>`).join('')}
      </select>
      <div class="card-meta" style="margin-top:6px;">Khi kết nối server, gói do server quyết định. Bộ chọn này phục vụ demo/quản trị offline.</div>

      <div style="margin-top:14px; padding:12px; border:1px dashed var(--c-border); border-radius:8px;">
        <div style="font-size:13px; font-weight:600; margin-bottom:8px;">🎬 Demo bán hàng</div>
        <div class="card-meta" style="margin-bottom:8px;">Tạo 2 lô mẫu: 1 lô đã thu hoạch (QR + phiếu truy xuất) + 1 lô đang khoá PHI (an toàn thực phẩm).</div>
        <div style="display:flex; gap:8px;">
          <button id="demo-seed" class="btn secondary" style="flex:1;">＋ Tạo dữ liệu mẫu</button>
          <button id="demo-clear" class="btn danger" style="flex:1;">Xoá dữ liệu mẫu</button>
        </div>
      </div>

      <hr style="margin:24px 0; border:0; border-top:1px solid var(--c-border);" />

      <h3 style="margin:0 0 10px; font-size:14px;">Tài khoản</h3>
      <div class="card-meta">Farmer ID: <strong>${escapeHtml(authStore.farmerId || '-')}</strong></div>

      <div style="margin-top:14px; padding:12px; border:1px solid var(--c-border); border-radius:8px;">
        <div style="font-size:13px; font-weight:600; margin-bottom:8px;">Đổi PIN (Local)</div>
        <input id="new-pin" type="password" inputmode="numeric" pattern="[0-9]{4,6}" maxlength="6" placeholder="PIN mới 4-6 số" style="margin-bottom:6px;" />
        <input id="new-pin2" type="password" inputmode="numeric" pattern="[0-9]{4,6}" maxlength="6" placeholder="Nhập lại PIN mới" />
        <button id="change-pin-btn" class="btn secondary" style="margin-top:8px; width:100%;">Đổi PIN</button>
      </div>

      <div style="margin-top:10px;">
        <button id="logout-btn" class="btn danger">Đăng xuất</button>
      </div>

      <p style="text-align:center; margin-top:30px; font-size:12px; color:var(--c-text-muted);">
        EcoSynTech Farm OS v4.0.0<br/>Build ${new Date().toISOString().slice(0,10)}
      </p>
    </div>
  `;
}

function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

window.wire_settings = function() {
  document.getElementById('test-server')?.addEventListener('click', async () => {
    const url = document.getElementById('set-url').value.trim();
    if (!url) return;
    try {
      const r = await fetch(url.replace(/\/$/,'') + '/api/health');
      window.showToast?.(r.ok ? '✓ Server OK' : `HTTP ${r.status}`, r.ok ? 'ok' : 'err');
    } catch (e) { window.showToast?.('✗ ' + e.message, 'err'); }
  });

  document.getElementById('save-settings')?.addEventListener('click', async () => {
    const url = document.getElementById('set-url').value.trim();
    const cloudUrl = document.getElementById('set-cloud').value.trim();
    const mode = document.getElementById('set-mode').value;
    // FIX #3 — validate trước khi lưu
    try {
      if (url && mode !== 'local') {
        const v = validateServerUrl(url);
        if (v.warning) window.showToast?.('⚠ ' + v.warning, '');
      }
      if (cloudUrl) validateServerUrl(cloudUrl, { isCloud: true });
    } catch (e) {
      window.showToast?.('✗ ' + e.message, 'err');
      return;
    }
    authStore.url = url;
    authStore.cloudUrl = cloudUrl;
    authStore.mode = mode;
    await authStore.save();
    bgsync.pushConfigToRunner(); // FIX #6 — runner cần url/token mới
    window.showToast?.('✓ Đã lưu', 'ok');
  });

  // V4.0 — đổi gói (demo/quản trị)
  document.getElementById('set-plan')?.addEventListener('change', async (e) => {
    authStore.plan = e.target.value;
    authStore.features = []; // offline: suy từ plan; server sẽ ghi đè khi login
    await authStore.save();
    window.showToast?.('✓ Đã chuyển gói ' + (PLANS[authStore.plan]?.name || ''), 'ok');
  });

  // V4.0 — demo data
  document.getElementById('demo-seed')?.addEventListener('click', async () => {
    const btn = document.getElementById('demo-seed');
    btn.disabled = true; btn.textContent = 'Đang tạo...';
    try {
      const r = await demoData.seed();
      window.showToast?.(`✓ Đã tạo ${r.lots} lô mẫu (1 đã thu hoạch, 1 đang khoá PHI). Vào More → Lô/Mùa vụ.`, 'ok');
    } catch (e) { window.showToast?.('✗ ' + e.message, 'err'); }
    btn.disabled = false; btn.textContent = '＋ Tạo dữ liệu mẫu';
  });

  document.getElementById('demo-clear')?.addEventListener('click', async () => {
    if (!confirm('Xoá toàn bộ dữ liệu mẫu? (Lô thật không bị ảnh hưởng)')) return;
    const n = await demoData.clear();
    window.showToast?.(n > 0 ? `✓ Đã xoá ${n} lô mẫu` : 'Không có dữ liệu mẫu', '');
  });

  // FIX #5 — dead-letter actions
  document.getElementById('dead-retry-all')?.addEventListener('click', async () => {
    await syncQueue.retryAllDead();
    await syncQueue.processQueue();
    window.showToast?.('✓ Đã đưa lại vào queue + sync', 'ok');
    document.querySelector('[x-data]').__x?.$data?.nav?.('settings');
  });

  document.getElementById('dead-export')?.addEventListener('click', async () => {
    try {
      const json = await syncQueue.exportDead();
      const name = `farmos-deadletter-${new Date().toISOString().slice(0,10)}.json`;
      await Filesystem.writeFile({ path: name, data: btoa(unescape(encodeURIComponent(json))), directory: Directory.Documents });
      window.showToast?.(`✓ Đã xuất Documents/${name}`, 'ok');
    } catch (e) { window.showToast?.('✗ ' + e.message, 'err'); }
  });

  (async () => {
    const el = document.getElementById('dead-list');
    if (!el) return;
    const items = await syncQueue.listDead();
    el.innerHTML = items.slice(0, 10).map(it => `
      <div style="font-size:12px; padding:6px 0; border-bottom:1px solid var(--c-border);">
        <strong>${escapeHtml(it.method || 'POST')}</strong> ${escapeHtml(it.path)} · ${escapeHtml(it.deadReason || '')}
        <br/><span style="color:var(--c-text-muted);">${new Date(it.deadAt || it.ts).toLocaleString('vi-VN')}</span>
        <button data-dead-retry="${escapeHtml(it.id)}" style="float:right; font-size:11px; padding:2px 8px;">Retry</button>
        <button data-dead-del="${escapeHtml(it.id)}" style="float:right; font-size:11px; padding:2px 8px; margin-right:4px; color:#c62828;">Xoá</button>
      </div>`).join('');
    el.querySelectorAll('[data-dead-retry]').forEach(b => b.addEventListener('click', async () => {
      await syncQueue.retryDead(b.dataset.deadRetry);
      window.showToast?.('✓ Đưa lại vào queue', 'ok');
      document.querySelector('[x-data]').__x?.$data?.nav?.('settings');
    }));
    el.querySelectorAll('[data-dead-del]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Xoá vĩnh viễn bản ghi lỗi này?')) return;
      await syncQueue.deleteDead(b.dataset.deadDel);
      document.querySelector('[x-data]').__x?.$data?.nav?.('settings');
    }));
  })();

  document.getElementById('force-sync')?.addEventListener('click', async () => {
    await syncQueue.processQueue();
    window.showToast?.('✓ Sync xong', 'ok');
    document.querySelector('[x-data]').__x?.$data?.nav?.('settings');
  });

  document.getElementById('clear-queue')?.addEventListener('click', async () => {
    if (!confirm('Xoá toàn bộ queue chưa sync? Dữ liệu offline sẽ MẤT.')) return;
    await syncQueue.clearAll();
    window.showToast?.('Đã xoá queue', '');
    document.querySelector('[x-data]').__x?.$data?.nav?.('settings');
  });

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    if (!confirm('Đăng xuất?')) return;
    await authStore.logout();
    window.location.reload();
  });

  document.getElementById('change-pin-btn')?.addEventListener('click', async () => {
    const p1 = document.getElementById('new-pin').value.trim();
    const p2 = document.getElementById('new-pin2').value.trim();
    if (!/^[0-9]{4,6}$/.test(p1)) { window.showToast?.('PIN phải 4-6 chữ số', 'err'); return; }
    if (p1 !== p2) { window.showToast?.('PIN xác nhận không khớp', 'err'); return; }
    try {
      await authStore.changePin(p1);
      document.getElementById('new-pin').value = '';
      document.getElementById('new-pin2').value = '';
      window.showToast?.('✓ Đã đổi PIN. Dùng PIN mới lần đăng nhập sau.', 'ok');
    } catch (e) {
      window.showToast?.('✗ ' + e.message, 'err');
    }
  });
};
