// Alert Center — GET /api/alerts + POST :id/acknowledge
import { fallbackFetch } from '../api/fallback-client.js';
import { syncQueue } from '../stores/sync.js';
import { get, set } from 'idb-keyval';

const CACHE_KEY = 'cache:alerts';

export async function renderAlerts() {
  let alerts = [];
  let fromCache = false;
  try {
    const r = await fallbackFetch('/api/alerts?status=open');
    if (r.ok) {
      const d = await r.json();
      alerts = Array.isArray(d) ? d : (d.items || d.alerts || []);
      await set(CACHE_KEY, { data: alerts, ts: Date.now() });
    } else throw new Error('HTTP ' + r.status);
  } catch (_) {
    const c = await get(CACHE_KEY);
    if (c) { alerts = c.data; fromCache = true; }
  }

  return `
    <div class="app-header">🚨 Alert Center
      <span style="float:right; font-size:12px; opacity:.8;">${alerts.length} open</span>
    </div>
    <div style="padding:10px 16px; font-size:12px; color:var(--c-text-muted);">
      ${fromCache ? '⚠ Offline cache' : '✓ Live'}
      <select id="alert-filter" style="float:right; padding:4px;">
        <option value="open">Đang mở</option>
        <option value="all">Tất cả</option>
        <option value="ack">Đã xác nhận</option>
      </select>
    </div>
    <div id="alert-list">${renderList(alerts)}</div>
  `;
}

function renderList(alerts) {
  if (!alerts.length) {
    return `<div class="empty"><div class="ico">✅</div><p>Không có cảnh báo mở.</p></div>`;
  }
  return alerts.map(a => {
    const sev = (a.severity || a.level || 'info').toLowerCase();
    const cls = sev === 'critical' || sev === 'high' ? 'crit'
              : sev === 'warning' || sev === 'medium' ? 'warn' : 'ok';
    const id = a.id || a._id || a.alertId;
    return `
      <div class="card ${cls} swipe-card" data-id="${id}">
        <div class="row">
          <div>
            <div class="card-title">${escapeHtml(a.title || a.message || 'Alert')}</div>
            <div class="card-meta">Zone ${escapeHtml(a.zoneId || a.zone || '-')} · ${escapeHtml(a.severity || a.level || 'info')}</div>
          </div>
          <button class="btn secondary ack-btn" data-id="${id}" style="width:auto; padding:6px 12px;">Ack</button>
        </div>
        <div class="card-meta" style="margin-top:6px;">${escapeHtml(fmtTime(a.createdAt || a.ts || a.timestamp))}</div>
        ${a.detail ? `<p style="margin:8px 0 0; font-size:13px;">${escapeHtml(a.detail)}</p>` : ''}
      </div>
    `;
  }).join('');
}

function fmtTime(t) {
  if (!t) return '-';
  try {
    const d = new Date(t);
    return d.toLocaleString('vi-VN');
  } catch { return String(t); }
}
function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

window.wire_alerts = function() {
  document.querySelectorAll('.ack-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = btn.dataset.id;
      btn.disabled = true; btn.textContent = '...';
      const path = `/api/alerts/${id}/acknowledge`;
      try {
        const r = await fallbackFetch(path, { method: 'POST', body: '{}' });
        if (r.ok) {
          window.showToast?.('✓ Đã xác nhận', 'ok');
          btn.closest('.card').remove();
        } else throw new Error('HTTP ' + r.status);
      } catch (err) {
        // Queue offline
        await syncQueue.enqueue({ path, method: 'POST', body: '{}' });
        window.showToast?.('⏳ Queue offline — sẽ sync sau', '');
        btn.closest('.card').remove();
      }
    });
  });
};
