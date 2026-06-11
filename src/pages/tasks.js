// Task List — GET /api/tasks + PATCH :id status
import { fallbackFetch } from '../api/fallback-client.js';
import { syncQueue } from '../stores/sync.js';
import { get, set } from 'idb-keyval';

const CACHE_KEY = 'cache:tasks';

export async function renderTasks() {
  let tasks = [];
  let fromCache = false;
  try {
    const r = await fallbackFetch('/api/tasks');
    if (r.ok) {
      const d = await r.json();
      tasks = Array.isArray(d) ? d : (d.items || d.tasks || []);
      await set(CACHE_KEY, { data: tasks, ts: Date.now() });
    } else throw new Error('HTTP ' + r.status);
  } catch (_) {
    const c = await get(CACHE_KEY);
    if (c) { tasks = c.data; fromCache = true; }
  }

  const groups = groupBy(tasks);
  return `
    <div class="app-header">✅ Task List</div>
    <div style="padding:10px 16px; font-size:12px; color:var(--c-text-muted);">
      ${fromCache ? '⚠ Cached' : '✓ Live'} · Tổng ${tasks.length}
    </div>
    ${section('Đang chạy', groups.running, 'running')}
    ${section('Hàng đợi', groups.queued, 'queued')}
    ${section('Hoàn thành (24h)', groups.completed, 'completed')}
  `;
}

function groupBy(tasks) {
  const out = { queued: [], running: [], completed: [] };
  for (const t of tasks) {
    const s = (t.status || 'queued').toLowerCase();
    if (s === 'running' || s === 'in_progress') out.running.push(t);
    else if (s === 'completed' || s === 'done') out.completed.push(t);
    else out.queued.push(t);
  }
  return out;
}

function section(title, list, pillClass) {
  if (!list.length) return '';
  return `
    <h3 style="padding:0 16px; margin:14px 0 0; color:var(--c-text-muted); font-size:13px; text-transform:uppercase;">${title} · ${list.length}</h3>
    ${list.map(t => taskCard(t, pillClass)).join('')}
  `;
}

function taskCard(t, pillClass) {
  const id = t.id || t.taskId || t._id;
  return `
    <div class="card" data-id="${id}">
      <div class="row">
        <div class="card-title">${escapeHtml(t.title || t.name || 'Task')}</div>
        <span class="pill ${pillClass}">${escapeHtml(t.status || 'queued')}</span>
      </div>
      <div class="card-meta">
        Zone ${escapeHtml(t.zoneId || t.zone || '-')}
        ${t.dueAt ? '· Hạn: ' + escapeHtml(new Date(t.dueAt).toLocaleString('vi-VN')) : ''}
        ${t.priority ? '· Ưu tiên: ' + escapeHtml(t.priority) : ''}
      </div>
      ${t.description ? `<p style="margin:8px 0 0; font-size:13px;">${escapeHtml(t.description)}</p>` : ''}
      ${pillClass !== 'completed' ? `
        <div style="margin-top:10px;">
          <button class="btn secondary complete-btn" data-id="${id}" style="width:auto; padding:8px 14px;">✓ Mark complete</button>
        </div>` : ''}
    </div>
  `;
}

function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

window.wire_tasks = function() {
  document.querySelectorAll('.complete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      btn.disabled = true; btn.textContent = '...';
      const path = `/api/tasks/${id}`;
      const body = JSON.stringify({ status: 'completed', completedAt: Date.now() });
      try {
        const r = await fallbackFetch(path, { method: 'PATCH', body });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        window.showToast?.('✓ Hoàn thành', 'ok');
        btn.closest('.card').remove();
      } catch (err) {
        await syncQueue.enqueue({ path, method: 'PATCH', body });
        window.showToast?.('⏳ Queue offline', '');
        btn.closest('.card').remove();
      }
    });
  });
};
