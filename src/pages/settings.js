import { authStore, validateServerUrl } from '../stores/auth.js';
import { syncQueue } from '../stores/sync.js';
import { bgsync } from '../stores/bgsync.js';
import { PLANS } from '../stores/plan.js';
import { pushStore } from '../stores/push.js';
import { demoData } from '../db/demo.js';
import { simulationStore } from '../stores/simulation.js';
import { auditStore } from '../stores/audit.js';
import { aptosConfig, aptosService } from '../stores/aptos-service.js';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { get, set, keys } from 'idb-keyval';

const DEV_MODE_KEY = 'dev:mode_active';
const FCM_KEY = 'push:fcm_enabled';

async function getDevMode() { return !!(await get(DEV_MODE_KEY)); }
async function getFcm() { return !!(await get(FCM_KEY)); }

export async function renderSettings() {
  const queueSize = await syncQueue.size();
  const deadSize = await syncQueue.deadSize();
  const devActive = await getDevMode();
  const fcmActive = await getFcm();
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

      <h3 style="margin:0 0 10px; font-size:14px;">🧪 Mô phỏng dữ liệu</h3>
      <div style="padding:12px; border:1px dashed var(--c-border); border-radius:8px;">
        <div class="card-meta" style="margin-bottom:8px;">Tạo dữ liệu cảm biến, cảnh báo, lịch giả lập để test giao diện khi chưa có thiết bị IoT.</div>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
          <input id="sim-toggle" type="checkbox" style="width:auto;" />
          <span><strong>Bật chế độ mô phỏng</strong></span>
        </label>
        <div class="card-meta" style="margin-top:6px;">Khi bật, sensor dashboard + overview sẽ hiển thị dữ liệu giả lập thay vì chờ thiết bị thật.</div>
      </div>

      <hr style="margin:24px 0; border:0; border-top:1px solid var(--c-border);" />

      <h3 style="margin:0 0 10px; font-size:14px;">⛓ Aptos Blockchain</h3>
      <div style="padding:12px; border:1px dashed #0288D1; border-radius:8px;">
        <div class="card-meta" style="margin-bottom:8px;">Kết nối với Aptos testnet/mainnet để ghi dữ liệu truy xuất lên blockchain thật. Cần deploy Move contract trước (xem <code>aptos-contract/</code>).</div>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; margin-bottom:6px;">
          <input id="aptos-enabled" type="checkbox" style="width:auto;" />
          <span><strong>🔗 Kết nối Aptos blockchain</strong></span>
        </label>
        <select id="aptos-network" class="form">
          <option value="testnet">Aptos Testnet</option>
          <option value="mainnet">Aptos Mainnet</option>
        </select>
        <input id="aptos-module-addr" class="form" placeholder="Module Address (ví dụ: 0x1234...)" />
        <input id="aptos-private-key" class="form" type="password" placeholder="Private Key (Ed25519)" />
        <div style="display:flex;gap:4px;margin-top:6px;">
          <button id="aptos-connect" class="btn primary" style="flex:1;background:#0288D1;font-size:12px;">🔌 Kết nối</button>
          <button id="aptos-fund" class="btn secondary" style="flex:1;font-size:12px;">💰 Faucet (testnet)</button>
        </div>
        <div id="aptos-status" style="margin-top:6px;font-size:12px;"></div>
        <div id="aptos-balance" style="margin-top:4px;font-size:11px;color:var(--c-text-muted);"></div>
      </div>

      <hr style="margin:24px 0; border:0; border-top:1px solid var(--c-border);" />

      <h3 style="margin:0 0 10px; font-size:14px;">📦 Xuất / Nhập cấu hình</h3>
      <div style="padding:12px; border:1px dashed var(--c-border); border-radius:8px;">
        <div class="card-meta" style="margin-bottom:8px;">Export JSON toàn bộ cấu hình (schedules, rules) để backup hoặc chuyển thiết bị. Import để khôi phục.</div>
        <div style="display:flex; gap:8px;">
          <button id="cfg-export" class="btn secondary" style="flex:1;">⬇ Xuất JSON</button>
          <button id="cfg-import-btn" class="btn secondary" style="flex:1;">⬆ Nhập JSON</button>
        </div>
        <input type="file" id="cfg-file" accept=".json,application/json" style="display:none;" />
      </div>

      <hr style="margin:24px 0; border:0; border-top:1px solid var(--c-border);" />

      <h3 style="margin:0 0 10px; font-size:14px;">🔔 Push notification (V5)</h3>
      <div style="padding:12px; border:1px dashed var(--c-border); border-radius:8px;">
        <div class="card-meta" style="margin-bottom:8px;">
          Mặc định: polling 30s + Local Notification (offline-safe).<br/>
          FCM (Firebase Cloud Messaging): cần cài plugin <code>@capacitor/push-notifications</code> + Firebase config — chỉ bật khi đã setup. Polling 30s vẫn chạy làm backup.
        </div>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
          <input id="set-fcm" type="checkbox" ${fcmActive?'checked':''} style="width:auto;" />
          <span>Bật FCM (nếu plugin có sẵn)</span>
        </label>
        <div id="fcm-status" class="card-meta" style="margin-top:6px; font-size:11px;">
          Trạng thái runtime: <strong id="fcm-runtime-status">đang kiểm tra...</strong>
        </div>
      </div>

      <hr style="margin:24px 0; border:0; border-top:1px solid var(--c-border);" />

      <h3 style="margin:0 0 10px; font-size:14px;">🔧 DEV mode (V5)</h3>
      <div style="padding:12px; border:1px dashed var(--c-border); border-radius:8px;">
        ${devActive ? `
          <div class="card-meta" style="color:#c62828; font-weight:600; margin-bottom:8px;">
            ⚠ DEV mode ĐANG BẬT — chỉ dùng để test, KHÔNG để trên production.
          </div>
          <div class="card-meta" style="margin-bottom:8px;">
            Hiện tại đang test tier: <strong>${escapeHtml(authStore.plan || '-')}</strong>
          </div>
          <button id="dev-off" class="btn danger" style="width:100%;">Tắt DEV mode</button>
        ` : `
          <div class="card-meta" style="margin-bottom:8px;">Nhập PIN DEV để bật chế độ test tier capability flags.</div>
          <input id="dev-pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="PIN DEV (4 số)" />
          <button id="dev-unlock" class="btn secondary" style="margin-top:8px; width:100%;">Mở khoá DEV</button>
        `}
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
        EcoSynTech Farm OS v5.0.0-rc1<br/>Build ${new Date().toISOString().slice(0,10)}
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
    bgsync.pushConfigToRunner();
    window.showToast?.('✓ Đã lưu', 'ok');
  });

  document.getElementById('set-plan')?.addEventListener('change', async (e) => {
    authStore.plan = e.target.value;
    authStore.features = [];
    await authStore.save();
    window.showToast?.('✓ Đã chuyển gói ' + (PLANS[authStore.plan]?.name || ''), 'ok');
  });

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

  // ============================================================
  // V5.0.0-rc1 — FCM toggle + DEV mode (PIN 9999)
  // ============================================================
  const fcmCheckbox = document.getElementById('set-fcm');
  if (fcmCheckbox) {
    fcmCheckbox.addEventListener('change', async (e) => {
      if (e.target.checked) {
        const ok = await pushStore.enableFcm();
        if (ok) {
          window.showToast?.('✓ FCM đã bật + đăng ký token', 'ok');
          updateFcmStatus(true);
        } else {
          window.showToast?.('⚠ Plugin FCM chưa cài — polling 30s vẫn chạy', '');
          e.target.checked = false;
          updateFcmStatus(false);
        }
      } else {
        await pushStore.disableFcm();
        window.showToast?.('FCM đã tắt — polling 30s vẫn chạy', '');
        updateFcmStatus(false);
      }
    });
    // Initial runtime status check
    (function() {
      const hasPlugin = !!(window.Capacitor?.Plugins?.PushNotifications);
      updateFcmStatus(hasPlugin && pushStore.fcmActive);
      const el = document.getElementById('fcm-runtime-status');
      if (el) {
        el.textContent = hasPlugin
          ? (pushStore.fcmActive ? 'FCM ACTIVE (token registered)' : 'plugin available, chưa register')
          : 'plugin CHƯA cài (web hoặc Android build không include @capacitor/push-notifications)';
      }
    })();
  }

  function updateFcmStatus(active) {
    const el = document.getElementById('fcm-runtime-status');
    if (!el) return;
    el.textContent = active ? 'FCM ACTIVE (token registered)' : 'FCM disabled — polling 30s active';
  }

  // Mô phỏng
  (async () => {
    const simToggle = document.getElementById('sim-toggle');
    if (!simToggle) return;
    simToggle.checked = await simulationStore.isActive();
    simToggle.addEventListener('change', async (e) => {
      await simulationStore.setActive(e.target.checked);
      window.showToast?.(e.target.checked ? '🧪 Mô phỏng BẬT — dữ liệu giả lập sẽ hiển thị' : '✓ Mô phỏng TẮT', '');
      document.querySelector('[x-data]').__x?.$data?.nav?.('settings');
    });
  })();

  // Xuất cấu hình JSON
  document.getElementById('cfg-export')?.addEventListener('click', async () => {
    const toast = (m, t) => window.showToast && window.showToast(m, t || '');
    try {
      const allKeys = await keys();
      const prefixes = ['rule:', 'cache:schedules', 'cache:', 'schedule:', 'plan:', 'auth_cfg'];
      const data = {};
      for (const k of allKeys) {
        if (typeof k === 'string' && prefixes.some(p => k.startsWith(p))) {
          data[k] = await get(k);
        }
      }
      data._exportedAt = new Date().toISOString();
      data._version = '5.3.0';
      const json = JSON.stringify(data, null, 2);
      const filename = `farmos-config-${new Date().toISOString().slice(0, 10)}.json`;
      const isNative = () => { try { return Capacitor.isNativePlatform && Capacitor.isNativePlatform(); } catch { return false; } };
      if (!isNative()) {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
      } else {
        await Filesystem.writeFile({ path: filename, data: json, directory: Directory.Cache, encoding: 'utf-8' });
        const { uri } = await Filesystem.getUri({ directory: Directory.Cache, path: filename });
        try { await Share.share({ title: filename, files: [uri] }); } catch (_) {}
      }
      toast('✓ Đã xuất cấu hình (' + Object.keys(data).length + ' keys)', 'ok');
    } catch (e) { toast('✗ ' + e.message, 'err'); }
  });

  // Nhập cấu hình JSON
  document.getElementById('cfg-import-btn')?.addEventListener('click', () => {
    document.getElementById('cfg-file')?.click();
  });
  document.getElementById('cfg-file')?.addEventListener('change', async (e) => {
    const toast = (m, t) => window.showToast && window.showToast(m, t || '');
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      const text = await f.text();
      const data = JSON.parse(text);
      let count = 0;
      for (const [k, v] of Object.entries(data)) {
        if (k.startsWith('_')) continue;
        await set(k, v);
        count++;
      }
      await auditStore.logConfig({ action: 'import', status: 'ok', detail: `Import ${count} keys từ ${f.name}` });
      toast('✓ Đã nhập ' + count + ' mục cấu hình', 'ok');
      document.querySelector('[x-data]').__x?.$data?.nav?.('settings');
    } catch (err) { toast('✗ Lỗi đọc JSON: ' + err.message, 'err'); }
    e.target.value = '';
  });

  // Aptos Blockchain config
  (async () => {
    const cfg = await aptosConfig.load();
    const enabledEl = document.getElementById('aptos-enabled');
    const networkEl = document.getElementById('aptos-network');
    const moduleAddrEl = document.getElementById('aptos-module-addr');
    const privKeyEl = document.getElementById('aptos-private-key');
    const statusEl = document.getElementById('aptos-status');
    const balanceEl = document.getElementById('aptos-balance');

    if (enabledEl) {
      enabledEl.checked = cfg.enabled;
      networkEl.value = cfg.network || 'testnet';
      moduleAddrEl.value = cfg.moduleAddress || '';
      privKeyEl.value = cfg.privateKey || '';

      if (cfg.enabled) {
        const conn = await aptosService.connect();
        statusEl.innerHTML = conn.connected
          ? '<span style="color:#2E7D32;">✅ Đã kết nối Aptos ' + cfg.network + ' — ' + conn.address.slice(0, 10) + '...</span>'
          : '<span style="color:#c62828;">⚠ ' + (conn.reason || 'Kết nối thất bại') + '</span>';
        if (conn.connected) {
          const bal = await aptosService.getAccountBalance();
          balanceEl.textContent = '💰 Số dư: ' + bal + ' APT';
        }
      }
    }

    document.getElementById('aptos-connect')?.addEventListener('click', async () => {
      const enabled = enabledEl.checked;
      const network = networkEl.value;
      const moduleAddress = moduleAddrEl.value.trim();
      const privateKey = privKeyEl.value.trim();

      if (enabled && (!moduleAddress || !privateKey)) {
        window.showToast?.('Nhập Module Address và Private Key', 'err');
        return;
      }

      await aptosConfig.save({ enabled, network, moduleAddress, privateKey });

      if (enabled) {
        const conn = await aptosService.connect();
        if (conn.connected) {
          statusEl.innerHTML = '<span style="color:#2E7D32;">✅ Đã kết nối ' + network + ' — ' + conn.address.slice(0, 10) + '...</span>';
          const bal = await aptosService.getAccountBalance();
          balanceEl.textContent = '💰 Số dư: ' + bal + ' APT';
          window.showToast?.('✅ Kết nối Aptos thành công!', 'ok');
        } else {
          statusEl.innerHTML = '<span style="color:#c62828;">⚠ ' + (conn.reason || 'Lỗi kết nối') + '</span>';
          window.showToast?.('✗ ' + (conn.reason || 'Kết nối thất bại'), 'err');
        }
      } else {
        await aptosService.disconnect();
        statusEl.innerHTML = '<span style="color:#999;">⏸ Đã ngắt kết nối</span>';
        balanceEl.textContent = '';
        window.showToast?.('Đã ngắt kết nối Aptos', '');
      }
    });

    document.getElementById('aptos-fund')?.addEventListener('click', async () => {
      const result = await aptosService.fundTestnet();
      if (result.success) {
        window.showToast?.('✅ Đã nhận 1 APT từ faucet', 'ok');
        const bal = await aptosService.getAccountBalance();
        balanceEl.textContent = '💰 Số dư: ' + bal + ' APT';
      } else {
        window.showToast?.('✗ ' + (result.error || 'Faucet thất bại'), 'err');
      }
    });
  })();

  // DEV mode unlock (PIN 9999)
  document.getElementById('dev-unlock')?.addEventListener('click', async () => {
    const pin = document.getElementById('dev-pin').value.trim();
    if (pin !== '9999') {
      window.showToast?.('✗ PIN DEV sai', 'err');
      return;
    }
    await set(DEV_MODE_KEY, true);
    window.showToast?.('✓ DEV mode ON — đổi tier ở dropdown gói', 'ok');
    document.querySelector('[x-data]').__x?.$data?.nav?.('settings');
  });

  document.getElementById('dev-off')?.addEventListener('click', async () => {
    if (!confirm('Tắt DEV mode? (Tier sẽ reset về server-controlled khi reconnect.)')) return;
    await set(DEV_MODE_KEY, false);
    window.showToast?.('DEV mode OFF', '');
    document.querySelector('[x-data]').__x?.$data?.nav?.('settings');
  });
};
