// rules.js — V4.0 TƯỚI THÔNG MINH theo mùa (gói Farmer trở lên)
// NGUYÊN TẮC: app CHỈ SOẠN — WLC validate + THỰC THI (kể cả khi điện thoại tắt).
// Mẫu nhanh theo mùa = ngưỡng nông học khuyến nghị, người dùng chỉnh được.
// Giới hạn an toàn ép ngay tại client (WLC enforce lại server-side):
//   thời lượng ≤ 60 phút/lần, ≤ 6 lần/ngày, ngưỡng trong dải hợp lệ.
import { get, set, del, keys } from 'idb-keyval';
import { syncQueue } from '../stores/sync.js';

const PREFIX = 'rule:';
const MAX_DURATION_MIN = 60;
const MAX_RUNS_PER_DAY = 6;

// Mẫu tưới khuyến nghị theo MÙA × LOẠI CÂY (độ ẩm đất %, phút/lần, lần/ngày)
const SEASONS = { dry: '☀️ Mùa khô', rainy: '🌧 Mùa mưa', transition: '🍃 Giao mùa' };
const CROPS = { leafy: '🥬 Rau ăn lá', fruit: '🌳 Cây ăn quả', greenhouse: '🏠 Nhà màng' };
const TEMPLATES = {
  dry:        { leafy: [45, 15, 4], fruit: [50, 30, 2], greenhouse: [55, 10, 5] },
  rainy:      { leafy: [35, 10, 2], fruit: [30, 15, 1], greenhouse: [45, 10, 3] },
  transition: { leafy: [40, 12, 3], fruit: [40, 20, 2], greenhouse: [50, 10, 4] }
};

const METRICS = {
  soil_moisture: { label: '💧 Độ ẩm đất', unit: '%', min: 0, max: 100 },
  temperature: { label: '🌡 Nhiệt độ', unit: '°C', min: -10, max: 60 },
  humidity: { label: '💨 Độ ẩm không khí', unit: '%', min: 0, max: 100 },
  light: { label: '☀️ Ánh sáng', unit: 'lux', min: 0, max: 200000 }
};

async function listRules() {
  const all = await keys();
  const ids = all.filter(k => typeof k === 'string' && k.startsWith(PREFIX));
  const out = [];
  for (const id of ids) { const v = await get(id); if (v) out.push({ id, ...v }); }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

export async function renderRules() {
  const rules = await listRules();
  return `
    <div class="app-header">💧 Tưới thông minh
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('more')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>

    <div class="card">
      <div class="card-meta">Tưới theo cảm biến + tối ưu theo mùa, chạy trên <strong>bộ điều khiển trung tâm tại trại</strong> — điện thoại tắt, mất mạng vẫn thực thi. Giới hạn an toàn: ≤ ${MAX_DURATION_MIN} phút/lần, ≤ ${MAX_RUNS_PER_DAY} lần/ngày.</div>
    </div>

    <div class="card">
      <div class="card-title" style="font-size:14px;">⚡ Mẫu nhanh theo mùa</div>
      <div class="card-meta" style="margin-bottom:8px;">Chọn mùa + loại cây → tự điền ngưỡng khuyến nghị, chỉnh lại được trước khi lưu.</div>
      <div style="display:flex; gap:8px;">
        <select id="tpl-season" style="flex:1;">${Object.entries(SEASONS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select>
        <select id="tpl-crop" style="flex:1;">${Object.entries(CROPS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select>
      </div>
      <button id="tpl-apply" class="btn secondary" style="margin-top:8px; width:100%;">Áp dụng mẫu</button>
    </div>

    <div class="form" style="padding-top:0;">
      <details id="rule-create-box">
        <summary class="btn" style="display:block; text-align:center; cursor:pointer; list-style:none;">＋ Tạo quy tắc mới</summary>
        <form id="rule-form" style="margin-top:12px;">
          <label>Tên quy tắc *</label>
          <input name="name" required placeholder="VD: Tưới rau khi đất khô" />

          <label>NẾU (điều kiện)</label>
          <select name="metric">
            ${Object.entries(METRICS).map(([k, m]) => `<option value="${k}">${m.label} (${m.unit})</option>`).join('')}
          </select>
          <div style="display:flex; gap:8px; margin-top:6px;">
            <input name="zoneId" placeholder="Zone (Z1...)" style="flex:1;" required />
            <select name="op" style="flex:1;"><option value="lt">nhỏ hơn (&lt;)</option><option value="gt">lớn hơn (&gt;)</option></select>
            <input name="threshold" type="number" step="0.1" placeholder="Ngưỡng" style="flex:1;" required />
          </div>

          <label style="margin-top:10px;">THÌ (hành động)</label>
          <div style="display:flex; gap:8px;">
            <input name="deviceId" placeholder="Thiết bị (relay/bơm)" style="flex:2;" required />
            <select name="action" style="flex:1;"><option value="on">BẬT</option></select>
          </div>
          <div style="display:flex; gap:8px; margin-top:6px;">
            <input name="durationMin" type="number" min="1" max="${MAX_DURATION_MIN}" value="15" style="flex:1;" required />
            <span style="align-self:center; font-size:13px; color:var(--c-text-muted);">phút/lần · tối đa</span>
            <input name="maxPerDay" type="number" min="1" max="${MAX_RUNS_PER_DAY}" value="3" style="flex:1;" required />
            <span style="align-self:center; font-size:13px; color:var(--c-text-muted);">lần/ngày</span>
          </div>

          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:10px;">
            <input type="checkbox" name="rainSkip" checked />
            <span>🌧 <strong>Né mưa</strong> — xác suất mưa ≥ 60% thì không tưới</span>
          </label>

          <details style="margin-top:10px;">
            <summary style="cursor:pointer; font-size:13px; color:var(--c-text-muted);">⚙ Nâng cao (khung giờ · nghỉ giữa 2 lần · ưu tiên)</summary>
            <div style="display:flex; gap:8px; margin-top:8px;">
              <input name="timeFrom" type="time" value="05:00" style="flex:1;" />
              <span style="align-self:center; font-size:13px; color:var(--c-text-muted);">→</span>
              <input name="timeTo" type="time" value="18:00" style="flex:1;" />
            </div>
            <div style="display:flex; gap:8px; margin-top:6px;">
              <input name="cooldownMin" type="number" min="5" max="720" value="30" style="flex:1;" />
              <span style="align-self:center; font-size:13px; color:var(--c-text-muted);">phút nghỉ giữa 2 lần</span>
              <select name="priority" style="flex:1;">
                <option value="low">Ưu tiên thấp</option>
                <option value="medium" selected>Ưu tiên vừa</option>
                <option value="high">Ưu tiên cao</option>
              </select>
            </div>
          </details>

          <button type="submit" class="btn" style="margin-top:14px;">Lưu quy tắc</button>
        </form>
      </details>
    </div>

    <h3 style="padding:14px 16px 4px; color:var(--c-text-muted); font-size:13px; text-transform:uppercase;">Quy tắc (${rules.length})</h3>
    ${rules.length === 0 ? `<div class="empty" style="padding:20px;"><p>Chưa có quy tắc. Dùng "Mẫu nhanh theo mùa" để tạo trong 10 giây.</p></div>` : ''}
    ${rules.map(r => {
      const m = METRICS[r.metric] || { label: r.metric, unit: '' };
      return `
      <div class="card">
        <div class="row">
          <div class="card-title">${esc(r.name)}</div>
          <span class="pill ${r.enabled ? 'completed' : ''}">${r.enabled ? 'Đang bật' : 'Tạm tắt'}</span>
        </div>
        <div class="card-meta" style="margin-top:4px;">
          NẾU ${m.label} <strong>Zone ${esc(r.zoneId)}</strong> ${r.op === 'lt' ? '&lt;' : '&gt;'} <strong>${esc(String(r.threshold))}${m.unit}</strong><br/>
          THÌ bật <strong>${esc(r.deviceId)}</strong> ${esc(String(r.durationMin))} phút · tối đa ${esc(String(r.maxPerDay))} lần/ngày<br/>
          ${r.rainSkip ? '🌧 Né mưa ≥60% · ' : ''}⏰ ${esc(r.timeFrom || '05:00')}–${esc(r.timeTo || '18:00')} · nghỉ ${esc(String(r.cooldownMin || 30))}p · ưu tiên ${r.priority === 'high' ? 'cao' : r.priority === 'low' ? 'thấp' : 'vừa'}
        </div>
        <div class="card-meta">${r.synced ? '✓ Đã đồng bộ bộ điều khiển' : '⏳ Chờ đồng bộ khi kết nối'}</div>
        <div style="margin-top:8px; display:flex; gap:8px;">
          <button data-rule-toggle="${esc(r.id)}" class="btn secondary" style="flex:1; padding:6px;">${r.enabled ? 'Tạm tắt' : 'Bật lại'}</button>
          <button data-rule-del="${esc(r.id)}" class="btn danger" style="flex:1; padding:6px;">Xoá</button>
        </div>
      </div>`;
    }).join('')}
  `;
}

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

window.wire_rules = function() {
  const nav = () => document.querySelector('[x-data]').__x.$data.nav('rules');

  // Mẫu nhanh theo mùa → prefill form
  document.getElementById('tpl-apply')?.addEventListener('click', () => {
    const season = document.getElementById('tpl-season').value;
    const crop = document.getElementById('tpl-crop').value;
    const [threshold, duration, perDay] = (TEMPLATES[season] || {})[crop] || [40, 15, 3];
    const form = document.getElementById('rule-form');
    const box = document.getElementById('rule-create-box');
    if (!form || !box) return;
    box.open = true;
    form.name.value = `Tưới ${CROPS[crop].replace(/^\S+\s/, '')} — ${SEASONS[season].replace(/^\S+\s/, '')}`;
    form.metric.value = 'soil_moisture';
    form.op.value = 'lt';
    form.threshold.value = threshold;
    form.durationMin.value = duration;
    form.maxPerDay.value = perDay;
    form.zoneId.focus();
    window.showToast?.(`✓ Đã điền mẫu: đất < ${threshold}% → tưới ${duration} phút, ${perDay} lần/ngày. Điền Zone + thiết bị rồi lưu.`, 'ok');
  });

  document.getElementById('rule-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const metric = fd.get('metric');
    const m = METRICS[metric];
    const threshold = parseFloat(fd.get('threshold'));
    const durationMin = parseInt(fd.get('durationMin'), 10);
    const maxPerDay = parseInt(fd.get('maxPerDay'), 10);
    // Validate an toàn — chặn tại client, WLC chặn lại lần nữa
    if (!m || isNaN(threshold) || threshold < m.min || threshold > m.max) {
      window.showToast?.(`✗ Ngưỡng phải trong ${m.min}–${m.max}${m.unit}`, 'err'); return;
    }
    if (!(durationMin >= 1 && durationMin <= MAX_DURATION_MIN)) {
      window.showToast?.(`✗ Thời lượng 1–${MAX_DURATION_MIN} phút`, 'err'); return;
    }
    if (!(maxPerDay >= 1 && maxPerDay <= MAX_RUNS_PER_DAY)) {
      window.showToast?.(`✗ Tối đa ${MAX_RUNS_PER_DAY} lần/ngày`, 'err'); return;
    }
    const cooldownMin = Math.min(720, Math.max(5, parseInt(fd.get('cooldownMin'), 10) || 30));
    const rule = {
      name: fd.get('name'), metric, zoneId: fd.get('zoneId'),
      op: fd.get('op'), threshold,
      deviceId: fd.get('deviceId'), action: 'on',
      durationMin, maxPerDay,
      rainSkip: !!fd.get('rainSkip'),
      timeFrom: fd.get('timeFrom') || '05:00',
      timeTo: fd.get('timeTo') || '18:00',
      cooldownMin,
      priority: fd.get('priority') || 'medium',
      enabled: true, synced: false, createdAt: Date.now()
    };
    const id = `${PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await set(id, rule);
    // Payload khớp schema WLC /api/rules (automation_rules: condition/action JSON + cooldown + timeWindow + priority)
    const wlcPayload = {
      clientRuleId: id,
      name: rule.name,
      description: `Tạo từ app mobile · Zone ${rule.zoneId}`,
      type: 'STATIC',
      enabled: true,
      condition: {
        metric: rule.metric, zoneId: rule.zoneId, op: rule.op, threshold: rule.threshold,
        skipIfRainProbGte: rule.rainSkip ? 60 : null
      },
      action: {
        type: 'device', deviceId: rule.deviceId, command: 'on',
        durationMin: rule.durationMin, maxPerDay: rule.maxPerDay, priority: rule.priority
      },
      cooldownMinutes: rule.cooldownMin,
      timeWindow: { from: rule.timeFrom, to: rule.timeTo },
      targetDevice: rule.deviceId
    };
    await syncQueue.enqueue({ path: '/api/rules', method: 'POST', body: JSON.stringify(wlcPayload) });
    window.showToast?.('✓ Đã lưu — sẽ đồng bộ xuống bộ điều khiển', 'ok');
    nav();
  });

  document.querySelectorAll('[data-rule-toggle]').forEach(b => b.addEventListener('click', async () => {
    const id = b.dataset.ruleToggle;
    const r = await get(id);
    if (!r) return;
    r.enabled = !r.enabled; r.synced = false;
    await set(id, r);
    await syncQueue.enqueue({ path: '/api/rules', method: 'PUT', body: JSON.stringify({ clientRuleId: id, enabled: r.enabled }) });
    nav();
  }));

  document.querySelectorAll('[data-rule-del]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Xoá quy tắc này? Bộ điều khiển sẽ ngừng thực thi sau khi đồng bộ.')) return;
    const id = b.dataset.ruleDel;
    await del(id);
    await syncQueue.enqueue({ path: '/api/rules', method: 'DELETE', body: JSON.stringify({ clientRuleId: id }) });
    window.showToast?.('Đã xoá — chờ đồng bộ', '');
    nav();
  }));
};
