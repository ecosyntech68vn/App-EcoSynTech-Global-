// Feature D — Schedule lịch tưới/bón
import { fallbackFetch } from '../api/fallback-client.js';
import { syncQueue } from '../stores/sync.js';
import { get, set } from 'idb-keyval';

const CACHE = 'cache:schedules';

export async function renderSchedule() {
  let list = [];
  let fromCache = false;
  try {
    const r = await fallbackFetch('/api/schedules');
    if (r.ok) {
      const d = await r.json();
      list = Array.isArray(d) ? d : (d.items || []);
      await set(CACHE, { data: list, ts: Date.now() });
    } else throw new Error('HTTP ' + r.status);
  } catch (_) {
    const c = await get(CACHE);
    if (c) { list = c.data; fromCache = true; }
  }

  return `
    <div class="app-header">⏰ Lịch tưới / bón
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('dashboard')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>
    <div style="padding:10px 16px; font-size:12px; color:var(--c-text-muted);">
      ${fromCache ? '⚠ Cached' : '✓ Live'} · ${list.length} lịch
    </div>

    <details class="card" style="margin:10px 16px;">
      <summary style="font-weight:700; cursor:pointer; padding:4px 0;">+ Tạo lịch mới</summary>
      <form id="schedule-form" style="margin-top:10px;">
        <label>Tên lịch</label>
        <input name="name" required placeholder="Tưới Z01 mỗi sáng" />

        <label>Hoạt động</label>
        <select name="action" required>
          <option value="irrigation_on">Bật tưới</option>
          <option value="irrigation_off">Tắt tưới</option>
          <option value="fertilizer_dose">Bón phân (auto dose)</option>
          <option value="light_on">Bật đèn</option>
          <option value="light_off">Tắt đèn</option>
        </select>

        <label>Zone</label>
        <input name="zoneId" required placeholder="Z01" />

        <label>Lặp lại (cron-like)</label>
        <select name="repeat">
          <option value="daily">Hàng ngày</option>
          <option value="weekdays">Thứ 2 - 6</option>
          <option value="weekends">Cuối tuần</option>
          <option value="once">1 lần</option>
        </select>

        <label>Giờ chạy</label>
        <input name="time" type="time" required value="06:00" />

        <label>Thời lượng (phút) - nếu áp dụng</label>
        <input name="duration" type="number" min="1" max="180" value="30" />

        <div style="margin-top:14px;">
          <button type="submit" class="btn">Lưu lịch</button>
        </div>
      </form>
    </details>

    <div id="schedule-list">
      ${list.length === 0
        ? `<div class="empty"><div class="ico">⏰</div><p>Chưa có lịch nào.</p></div>`
        : list.map(scheduleCard).join('')}
    </div>
  `;
}

function scheduleCard(s) {
  const id = s.id || s._id || s.scheduleId;
  const enabled = s.enabled !== false;
  return `
    <div class="card ${enabled ? 'ok' : ''}" data-id="${id}">
      <div class="row">
        <div class="card-title">${escapeHtml(s.name || 'Lịch')}</div>
        <label style="display:flex;align-items:center;gap:4px;font-size:13px;">
          <input type="checkbox" ${enabled ? 'checked' : ''} class="schedule-toggle" data-id="${id}" />
          ${enabled ? 'ON' : 'OFF'}
        </label>
      </div>
      <div class="card-meta">${escapeHtml(s.action || '-')} · Zone ${escapeHtml(s.zoneId || '-')}</div>
      <div class="card-meta">⏰ ${escapeHtml(s.time || s.cron || '-')} · ${escapeHtml(s.repeat || 'daily')} · ${escapeHtml(s.duration || '-')} phút</div>
      <div style="margin-top:8px;">
        <button class="btn danger schedule-delete" data-id="${id}" style="width:auto; padding:6px 12px; font-size:12px;">🗑 Xoá</button>
      </div>
    </div>
  `;
}

function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

window.wire_schedule = function() {
  document.getElementById('schedule-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      name: fd.get('name'),
      action: fd.get('action'),
      zoneId: fd.get('zoneId'),
      repeat: fd.get('repeat'),
      time: fd.get('time'),
      duration: parseInt(fd.get('duration')),
      enabled: true,
      createdAt: Date.now()
    };
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const r = await fallbackFetch('/api/schedules', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      window.showToast?.('✓ Đã lưu lịch', 'ok');
    } catch (err) {
      await syncQueue.enqueue({ path: '/api/schedules', method: 'POST', body: JSON.stringify(payload) });
      window.showToast?.('⏳ Queue offline', '');
    }
    btn.disabled = false;
    document.querySelector('[x-data]').__x.$data.nav('schedule');
  });

  document.querySelectorAll('.schedule-delete').forEach(b => {
    b.addEventListener('click', async () => {
      const id = b.dataset.id;
      if (!confirm('Xoá lịch?')) return;
      try {
        const r = await fallbackFetch(`/api/schedules/${id}`, { method: 'DELETE' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        window.showToast?.('✓ Đã xoá', 'ok');
        b.closest('.card').remove();
      } catch (err) {
        await syncQueue.enqueue({ path: `/api/schedules/${id}`, method: 'DELETE', body: '{}' });
        window.showToast?.('⏳ Queue offline', '');
      }
    });
  });

  document.querySelectorAll('.schedule-toggle').forEach(t => {
    t.addEventListener('change', async () => {
      const id = t.dataset.id;
      const enabled = t.checked;
      const path = `/api/schedules/${id}`;
      const body = JSON.stringify({ enabled });
      try {
        const r = await fallbackFetch(path, { method: 'PUT', body });
        if (!r.ok) throw new Error('HTTP ' + r.status);
      } catch (err) {
        await syncQueue.enqueue({ path, method: 'PUT', body });
      }
    });
  });
};
