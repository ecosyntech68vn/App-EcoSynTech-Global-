// Feature L — Multi-farm switcher
import { fallbackFetch } from '../api/fallback-client.js';
import { authStore } from '../stores/auth.js';
import { get, set } from 'idb-keyval';

const CACHE = 'cache:farms';

export async function renderFarms() {
  let farms = [];
  let fromCache = false;
  try {
    const r = await fallbackFetch('/api/farms');
    if (r.ok) {
      const d = await r.json();
      farms = Array.isArray(d) ? d : (d.items || d.farms || []);
      await set(CACHE, { data: farms, ts: Date.now() });
    } else throw new Error('HTTP ' + r.status);
  } catch (_) {
    const c = await get(CACHE);
    if (c) { farms = c.data; fromCache = true; }
  }

  return `
    <div class="app-header">🏡 Chọn nông trại
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('dashboard')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>
    <div style="padding:10px 16px; font-size:12px; color:var(--c-text-muted);">
      ${fromCache ? '⚠ Cached' : '✓ Live'} · ${farms.length} nông trại
    </div>
    ${farms.length === 0
      ? `<div class="empty"><div class="ico">🏡</div><p>Chưa có nông trại.</p></div>`
      : farms.map(f => {
          const id = f.id || f._id || f.farmId;
          const active = id === authStore.activeFarmId;
          return `
            <div class="card ${active ? 'ok' : ''}" data-id="${id}">
              <div class="row">
                <div>
                  <div class="card-title">${escapeHtml(f.name || id)}</div>
                  <div class="card-meta">${escapeHtml(f.location || f.address || '-')}</div>
                </div>
                ${active ? '<span class="pill completed">ACTIVE</span>' : `<button class="btn secondary set-active" data-id="${id}" style="width:auto;padding:6px 12px;">Chọn</button>`}
              </div>
            </div>
          `;
        }).join('')}
  `;
}
function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

window.wire_farms = function() {
  document.querySelectorAll('.set-active').forEach(b => {
    b.addEventListener('click', async () => {
      authStore.activeFarmId = b.dataset.id;
      await authStore.save();
      window.showToast && window.showToast('✓ Đã chọn nông trại', 'ok');
      document.querySelector('[x-data]').__x.$data.nav('farms');
    });
  });
};
