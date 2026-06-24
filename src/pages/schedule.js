import { fallbackFetch } from '../api/fallback-client.js';
import { syncQueue } from '../stores/sync.js';
import { get, set } from 'idb-keyval';

const CACHE = 'cache:schedules';

const ACTION_META = {
  irrigation_on: { icon: '💧', label: 'Bật tưới', color: '#0277BD' },
  irrigation_off: { icon: '⏹', label: 'Tắt tưới', color: '#78909C' },
  fertilizer_dose: { icon: '🧪', label: 'Bón phân', color: '#2E7D32' },
  light_on: { icon: '💡', label: 'Bật đèn', color: '#F9A825' },
  light_off: { icon: '⏹', label: 'Tắt đèn', color: '#78909C' }
};

const REPEAT_LABEL = {
  daily: 'Hàng ngày',
  weekdays: 'Thứ 2 - Thứ 6',
  weekends: 'Thứ 7 - CN',
  custom: 'Tuỳ chỉnh',
  once: 'Một lần'
};

const DAY_NAMES = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const PRIORITY = [
  { value: 'low', label: 'Thấp (có thể bỏ qua)' },
  { value: 'medium', label: 'Vừa (mặc định)' },
  { value: 'high', label: 'Cao (ưu tiên thực thi)' }
];

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function section(title, html) {
  return `<div class="card" style="margin:8px 16px;"><div class="card-title" style="font-size:15px;margin-bottom:10px;">${title}</div>${html}</div>`;
}

function fieldRow(label, input) {
  return `<div style="margin-bottom:12px;"><div style="font-size:13px;font-weight:600;color:var(--c-text-muted);margin-bottom:4px;">${label}</div>${input}</div>`;
}

const inp = (n, opts) => {
  const t = opts?.type || 'text';
  const ph = opts?.ph || '';
  const v = opts?.val != null ? `value="${esc(opts.val)}"` : '';
  const extra = opts?.extra || '';
  return `<input name="${n}" type="${t}" ${ph ? `placeholder="${esc(ph)}"` : ''} ${v} ${opts?.req ? 'required' : ''} ${extra} style="width:100%;padding:11px 12px;border:1px solid var(--c-border);border-radius:var(--r-sm);font-size:15px;background:#fff;box-sizing:border-box;" />`;
};
const sel = (n, opts, items) => {
  const itemsHtml = items.map(i => `<option value="${i.value}" ${i.value === (opts?.def || '') ? 'selected' : ''}>${esc(i.label)}${i.sub ? ' · ' + esc(i.sub) : ''}</option>`).join('');
  return `<select name="${n}" style="width:100%;padding:11px 12px;border:1px solid var(--c-border);border-radius:var(--r-sm);font-size:15px;background:#fff;">${itemsHtml}</select>`;
};
const inline = (children) => `<div style="display:flex;gap:8px;align-items:center;">${children}</div>`;

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

    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 16px 4px;">
      <span style="font-size:13px;color:var(--c-text-muted);">${fromCache ? '⚠ Dữ liệu cache' : '✓ Trực tiếp'} · <strong>${list.length}</strong> lịch</span>
      <button id="schedule-add-btn" class="btn secondary" style="width:auto;padding:6px 14px;font-size:13px;">＋ Tạo lịch</button>
    </div>

    <div id="schedule-form-wrap" style="display:none;">
      <form id="schedule-form" style="padding:0;">
        ${section('📝 Thông tin cơ bản', `
          ${fieldRow('Tên lịch *', inp('name', { req: true, ph: 'VD: Tưới Z01 sáng, Bón phân cho cà chua...' }))}
          ${fieldRow('Ghi chú / mô tả', inp('note', { ph: 'Mô tả ngắn gọn mục đích lịch này' }))}
        `)}

        ${section('⚙️ Hoạt động', `
          ${fieldRow('Loại hoạt động *', sel('action', { def: 'irrigation_on' }, [
            { value: 'irrigation_on', label: '💧 Bật tưới' },
            { value: 'irrigation_off', label: '⏹ Tắt tưới' },
            { value: 'fertilizer_dose', label: '🧪 Bón phân (auto dose)' },
            { value: 'light_on', label: '💡 Bật đèn' },
            { value: 'light_off', label: '⏹ Tắt đèn' }
          ]))}
          ${fieldRow('Khu vực (Zone) *', inp('zoneId', { req: true, ph: 'VD: Z01, Zone A, Nhà màng số 2...' }))}
          ${fieldRow('Thiết bị / Relay', inp('device', { ph: 'Để trống nếu dùng mặc định (VD: relay_001)' }))}
        `)}

        ${section('📅 Lịch trình', `
          ${fieldRow('Lặp lại *', sel('repeat', { def: 'daily' }, [
            { value: 'daily', label: 'Hàng ngày' },
            { value: 'weekdays', label: 'Thứ 2 → Thứ 6' },
            { value: 'weekends', label: 'Thứ 7 + Chủ nhật' },
            { value: 'custom', label: 'Tuỳ chỉnh theo ngày' },
            { value: 'once', label: 'Một lần' }
          ]))}
          <div id="schedule-dow-wrap" style="display:none;margin-bottom:12px;">
            <div style="font-size:13px;font-weight:600;color:var(--c-text-muted);margin-bottom:6px;">Chọn ngày trong tuần</div>
            <div style="display:flex;gap:6px;">${DAY_NAMES.map((d, i) =>
              `<label style="display:flex;flex-direction:column;align-items:center;gap:2px;font-size:12px;color:var(--c-text-muted);cursor:pointer;"><input type="checkbox" name="dow" value="${i}" checked style="width:auto;" /><span>${d}</span></label>`
            ).join('')}</div>
          </div>
          ${fieldRow('Giờ chạy *', inp('time', { type: 'time', val: '06:00', req: true }))}
          ${inline([
            `<div style="flex:1;">${fieldRow('Ngày bắt đầu', inp('startDate', { type: 'date' }))}</div>`,
            `<div style="flex:1;">${fieldRow('Ngày kết thúc', inp('endDate', { type: 'date', ph: 'Để trống = vô thời hạn' }))}</div>`
          ].join(''))}
        `)}

        ${section('🔧 Thông số kỹ thuật', `
          <div style="display:flex;gap:8px;">
            <div style="flex:1;">${fieldRow('Thời lượng (phút)', inp('duration', { type: 'number', extra: 'min="1" max="180" value="30"' }))}</div>
            <div style="flex:1;">${fieldRow('Tối đa / ngày', inp('maxPerDay', { type: 'number', extra: 'min="1" max="20" value="3"' }))}</div>
          </div>
          ${fieldRow('Nghỉ giữa các lần (phút)', inp('cooldown', { type: 'number', extra: 'min="0" max="720" value="0"', ph: '0 = không nghỉ' }))}
          ${fieldRow('Mức ưu tiên', sel('priority', { def: 'medium' }, PRIORITY))}
        `)}

        <div style="padding:0 16px 16px;">
          <div id="schedule-err" style="display:none;background:#ffebee;border:1px solid #ef9a9a;color:#c62828;border-radius:8px;padding:9px 12px;margin-bottom:12px;font-size:13px;font-weight:600;"></div>
          <div style="display:flex;gap:10px;">
            <button type="button" id="schedule-cancel" class="btn secondary" style="flex:1;">Huỷ</button>
            <button type="submit" class="btn" style="flex:2;">💾 Lưu lịch</button>
          </div>
        </div>
      </form>
    </div>

    <div style="height:4px;"></div>
    <div id="schedule-list">
      ${list.length === 0
        ? `<div class="empty"><div class="ico">⏰</div><p>Chưa có lịch nào. Nhấn "＋ Tạo lịch" để bắt đầu.</p></div>`
        : list.map(scheduleCard).join('')}
    </div>
  `;
}

function scheduleCard(s) {
  const id = s.id || s._id || s.scheduleId;
  const enabled = s.enabled !== false;
  const meta = ACTION_META[s.action] || { icon: '⚙️', label: s.action || 'Không rõ', color: '#78909C' };
  const repeatLabel = REPEAT_LABEL[s.repeat] || s.repeat || 'daily';
  return `
    <div class="card ${enabled ? 'ok' : ''}" data-id="${id}" style="position:relative;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="display:flex;gap:10px;align-items:center;flex:1;">
          <span style="font-size:26px;line-height:1;">${meta.icon}</span>
          <div style="flex:1;">
            <div style="font-weight:700;font-size:16px;">${esc(s.name || 'Lịch')}</div>
            <div style="font-size:13px;color:${meta.color};font-weight:600;">${meta.label}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="pill ${enabled ? 'completed' : 'pending-sync'}" style="font-size:10px;padding:2px 10px;">${enabled ? 'BẬT' : 'TẮT'}</span>
          <label style="display:flex;align-items:center;gap:3px;font-size:12px;cursor:pointer;">
            <input type="checkbox" ${enabled ? 'checked' : ''} class="schedule-toggle" data-id="${id}" style="width:auto;" />
          </label>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:4px 16px;margin-top:8px;font-size:13px;color:var(--c-text-muted);">
        <span>📍 ${esc(s.zoneId || '-')}</span>
        <span>🕐 ${esc(s.time || '-')}</span>
        <span>🔄 ${repeatLabel}</span>
        <span>⏱ ${s.duration || '-'} phút</span>
        ${s.maxPerDay ? `<span>🔁 ${s.maxPerDay} lần/ngày</span>` : ''}
      </div>
      ${s.note ? `<div style="margin-top:6px;font-size:13px;color:var(--c-text-muted);font-style:italic;">📌 ${esc(s.note)}</div>` : ''}
      <div style="margin-top:10px;">
        <button class="schedule-delete btn danger" data-id="${id}" style="width:auto;padding:6px 12px;font-size:12px;">🗑 Xoá</button>
      </div>
    </div>
  `;
}

window.wire_schedule = function () {
  const nav = () => document.querySelector('[x-data]').__x.$data.nav('schedule');
  const toast = (m, t) => window.showToast && window.showToast(m, t || '');
  const showErr = m => { const e = document.getElementById('schedule-err'); if (e) { e.textContent = '⚠ ' + m; e.style.display = 'block'; } };
  const hideErr = () => { const e = document.getElementById('schedule-err'); if (e) e.style.display = 'none'; };

  const addBtn = document.getElementById('schedule-add-btn');
  const formWrap = document.getElementById('schedule-form-wrap');
  const cancelBtn = document.getElementById('schedule-cancel');
  const repeatSel = document.getElementById('schedule-form')?.querySelector('[name=repeat]');
  const dowWrap = document.getElementById('schedule-dow-wrap');

  if (addBtn && formWrap) {
    addBtn.addEventListener('click', () => { formWrap.style.display = 'block'; addBtn.style.display = 'none'; hideErr(); });
  }
  if (cancelBtn && formWrap && addBtn) {
    cancelBtn.addEventListener('click', () => { formWrap.style.display = 'none'; addBtn.style.display = ''; });
  }

  if (repeatSel && dowWrap) {
    const toggleDow = () => { dowWrap.style.display = repeatSel.value === 'custom' ? 'block' : 'none'; };
    repeatSel.addEventListener('change', toggleDow);
    toggleDow();
  }

  document.getElementById('schedule-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideErr();
    const fd = new FormData(e.target);
    const name = (fd.get('name') || '').trim();
    if (!name) { showErr('Vui lòng nhập tên lịch'); return; }

    let repeatDays = null;
    if (fd.get('repeat') === 'custom') {
      const checked = e.target.querySelectorAll('[name=dow]:checked');
      if (checked.length === 0) { showErr('Chọn ít nhất 1 ngày trong tuần'); return; }
      repeatDays = Array.from(checked).map(c => parseInt(c.value));
    }

    const payload = {
      name,
      action: fd.get('action'),
      zoneId: (fd.get('zoneId') || '').trim(),
      device: (fd.get('device') || '').trim() || null,
      repeat: fd.get('repeat'),
      repeatDays,
      time: fd.get('time'),
      startDate: fd.get('startDate') || null,
      endDate: fd.get('endDate') || null,
      duration: Math.min(180, Math.max(1, parseInt(fd.get('duration')) || 30)),
      maxPerDay: Math.min(20, Math.max(1, parseInt(fd.get('maxPerDay')) || 3)),
      cooldown: Math.min(720, Math.max(0, parseInt(fd.get('cooldown')) || 0)),
      priority: fd.get('priority') || 'medium',
      note: (fd.get('note') || '').trim() || null,
      enabled: true,
      createdAt: Date.now()
    };

    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; const orig = btn.textContent; btn.textContent = '⏳ Đang lưu...';
    try {
      const r = await fallbackFetch('/api/schedules', { method: 'POST', body: JSON.stringify(payload) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      toast('✓ Đã lưu lịch "' + name + '"', 'ok');
      formWrap.style.display = 'none';
      if (addBtn) addBtn.style.display = '';
      nav();
    } catch (err) {
      await syncQueue.enqueue({ path: '/api/schedules', method: 'POST', body: JSON.stringify(payload) });
      toast('⏳ Đã xếp vào hàng đợi — sẽ đồng bộ khi có mạng', '');
      formWrap.style.display = 'none';
      if (addBtn) addBtn.style.display = '';
      nav();
    }
    btn.disabled = false; btn.textContent = orig;
  });

  document.querySelectorAll('.schedule-delete').forEach(b => {
    b.addEventListener('click', async () => {
      const id = b.dataset.id;
      if (!confirm('Xoá lịch này? Hành động này không thể hoàn tác.')) return;
      try {
        const r = await fallbackFetch(`/api/schedules/${id}`, { method: 'DELETE' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        toast('✓ Đã xoá lịch', 'ok');
        b.closest('.card').remove();
      } catch (err) {
        await syncQueue.enqueue({ path: `/api/schedules/${id}`, method: 'DELETE', body: '{}' });
        toast('⏳ Sẽ xoá khi online', '');
        b.closest('.card').remove();
      }
    });
  });

  document.querySelectorAll('.schedule-toggle').forEach(t => {
    t.addEventListener('change', async () => {
      const id = t.dataset.id;
      const enabled = t.checked;
      const card = t.closest('.card');
      if (card) {
        card.className = card.className.replace(/\s?\b(ok|crit|warn)\b/g, '') + (enabled ? ' ok' : '');
        const pill = card.querySelector('.pill');
        if (pill) { pill.textContent = enabled ? 'BẬT' : 'TẮT'; pill.className = 'pill ' + (enabled ? 'completed' : 'pending-sync'); }
      }
      try {
        const r = await fallbackFetch(`/api/schedules/${id}`, { method: 'PUT', body: JSON.stringify({ enabled }) });
        if (!r.ok) throw new Error('HTTP ' + r.status);
      } catch (err) {
        await syncQueue.enqueue({ path: `/api/schedules/${id}`, method: 'PUT', body: JSON.stringify({ enabled }) });
      }
    });
  });
};
