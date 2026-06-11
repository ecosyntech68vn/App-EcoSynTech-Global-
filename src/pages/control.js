// Feature B — Manual device control với 2-step confirm
import { fallbackFetch } from '../api/fallback-client.js';
import { syncQueue } from '../stores/sync.js';
import { authStore } from '../stores/auth.js';
import { get, set } from 'idb-keyval';

const DEV_CACHE = 'cache:devices';

export async function renderControl() {
  let devices = [];
  let fromCache = false;
  try {
    const r = await fallbackFetch('/api/devices');
    if (r.ok) {
      const d = await r.json();
      devices = Array.isArray(d) ? d : (d.items || d.devices || []);
      await set(DEV_CACHE, { data: devices, ts: Date.now() });
    } else throw new Error('HTTP ' + r.status);
  } catch (_) {
    const c = await get(DEV_CACHE);
    if (c) { devices = c.data; fromCache = true; }
  }

  return `
    <div class="app-header">⚡ Điều khiển thiết bị
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('dashboard')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>
    <div style="padding:10px 16px; font-size:12px; color:var(--c-text-muted);">
      ${fromCache ? '⚠ Cached' : '✓ Live'} · ${devices.length} thiết bị
    </div>
    <div style="padding:0 16px; background:#FFF3CD; margin:10px 16px; border-radius:8px; padding:10px; font-size:13px; color:#8B6914;">
      ⚠ Điều khiển trực tiếp thiết bị thật. Mọi lệnh sẽ có audit log + yêu cầu xác nhận 2 bước.
    </div>
    ${devices.length === 0
      ? `<div class="empty"><div class="ico">📡</div><p>Không có thiết bị.</p></div>`
      : devices.map(deviceCard).join('')}
  `;
}

function deviceCard(d) {
  const id = d.id || d.deviceId;
  const status = (d.status || 'unknown').toLowerCase();
  const cls = status === 'online' ? 'ok' : status === 'offline' ? 'crit' : 'warn';
  return `
    <div class="card ${cls}" data-id="${id}">
      <div class="row">
        <div class="card-title">${escapeHtml(d.name || id)}</div>
        <span class="pill ${status === 'online' ? 'completed' : 'pending-sync'}">${status}</span>
      </div>
      <div class="card-meta">${escapeHtml(d.type || 'device')} · Zone ${escapeHtml(d.zoneId || '-')}</div>
      <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn secondary cmd-btn" data-id="${id}" data-action="pump_on" style="flex:1; min-width:120px; padding:10px;">💧 Bơm ON</button>
        <button class="btn secondary cmd-btn" data-id="${id}" data-action="pump_off" style="flex:1; min-width:120px; padding:10px;">⏹ Bơm OFF</button>
        <button class="btn secondary cmd-btn" data-id="${id}" data-action="light_on" style="flex:1; min-width:120px; padding:10px;">💡 Đèn ON</button>
        <button class="btn secondary cmd-btn" data-id="${id}" data-action="light_off" style="flex:1; min-width:120px; padding:10px;">⏹ Đèn OFF</button>
      </div>
    </div>
  `;
}

function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

window.wire_control = function() {
  document.querySelectorAll('.cmd-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      // Step 1: confirm
      if (!confirm(`Bước 1: Bạn chắc chắn gửi lệnh "${action}" tới thiết bị ${id}?`)) return;
      // Step 2: PIN re-enter
      const pin = prompt(`Bước 2: Nhập lại PIN xác thực để xác nhận`);
      if (!pin) return;
      const expectedPin = authStore.cachedPin || '';
      if (expectedPin && pin !== expectedPin) {
        window.showToast?.('✗ PIN sai', 'err'); return;
      }
      btn.disabled = true; const orig = btn.textContent; btn.textContent = '⏳';
      const path = `/api/devices/${id}/command`;
      const body = JSON.stringify({
        action,
        params: {},
        ts: Date.now(),
        farmerId: authStore.farmerId,
        confirmed: true
      });
      try {
        const r = await fallbackFetch(path, { method: 'POST', body });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        window.showToast?.(`✓ Lệnh ${action} đã gửi`, 'ok');
      } catch (err) {
        await syncQueue.enqueue({ path, method: 'POST', body });
        window.showToast?.('⏳ Queue offline — gửi khi online', '');
      }
      btn.disabled = false; btn.textContent = orig;
    });
  });
};
