// rules.js — V5.2 TƯỚI THÔNG MINH (khớp Web Local v6.1).
// NGUYÊN TẮC: app CHỈ SOẠN cấu hình; bộ điều khiển/WLC THỰC THI thuật toán (fuzzy/ETo/Kc),
//   chạy được cả khi điện thoại tắt / mất mạng. App không nhồi thuật toán nặng vào máy.
// 4 chế độ, đẩy ĐÚNG schema web đã đọc trong repo:
//   · comparison            → /api/automation/rules  (NẾU cảm biến <> ngưỡng THÌ bật)
//   · schedule              → /api/automation/rules  (tưới theo khung giờ)
//   · schedule_and_condition→ /api/automation/rules  (đúng giờ VÀ cảm biến đạt ngưỡng)
//   · crop (ETo/Kc)         → /api/irrigation/zones (+/crops nếu sửa) — WLC tự tính lượng theo cây + giai đoạn
// Khung giờ (windows) = lúc ĐƯỢC tưới; ngoài khung = không tưới → tự tránh trưa nắng.
// An toàn ép tại client (WLC ép lại): ≤ 60 phút/lần, ≤ 6 lần/ngày, ngưỡng trong dải hợp lệ.
import { get, set, del, keys } from 'idb-keyval';
import { syncQueue } from '../stores/sync.js';
import { authStore } from '../stores/auth.js';

const PREFIX = 'rule:';
const MAX_DURATION_MIN = 60;
const MAX_RUNS_PER_DAY = 6;

const MODES = {
  comparison: '💧 Theo cảm biến (ẩm đất)',
  schedule: '⏰ Theo lịch giờ',
  schedule_and_condition: '⏰+💧 Lịch + cảm biến',
  crop: '🌱 Theo cây (ETo/Kc tự tính)'
};

// Cảm biến (key khớp sensor_type bên WLC) + dải hợp lệ
const SENSORS = {
  soil_moisture: { label: '💧 Độ ẩm đất', unit: '%', min: 0, max: 100 },
  temp: { label: '🌡 Nhiệt độ', unit: '°C', min: -10, max: 60 },
  humidity: { label: '💨 Ẩm không khí', unit: '%', min: 0, max: 100 },
  ph: { label: '⚗️ pH', unit: '', min: 0, max: 14 },
  ec: { label: '🧪 EC', unit: 'mS/cm', min: 0, max: 10 }
};

// Hồ sơ cây (khớp seed crop_profiles bên WLC) — offline, không cần mạng
const CROP_CATALOG = [
  { id: 'default', name: 'Mặc định', cat: 'veg', min: 30, target: 50, max: 75, win: [[5, 8], [16, 18]] },
  { id: 'rau_muong', name: 'Rau muống', cat: 'veg', min: 40, target: 60, max: 85, win: [[5, 8], [16, 18]] },
  { id: 'rau_cai', name: 'Rau cải', cat: 'veg', min: 40, target: 60, max: 85, win: [[5, 8], [16, 18]] },
  { id: 'ca_chua', name: 'Cà chua', cat: 'veg', min: 35, target: 55, max: 80, win: [[5, 8], [16, 18]] },
  { id: 'sau_rieng', name: 'Sầu riêng', cat: 'perennial', min: 30, target: 50, max: 70, win: [[5, 8], [16, 18]] },
  { id: 'xoai', name: 'Xoài', cat: 'perennial', min: 25, target: 45, max: 70, win: [[5, 8], [16, 18]] },
  { id: 'ca_phe', name: 'Cà phê', cat: 'perennial', min: 28, target: 48, max: 70, win: [[5, 8], [16, 18]] },
  { id: 'ho_tieu', name: 'Hồ tiêu', cat: 'perennial', min: 30, target: 50, max: 72, win: [[5, 8], [16, 18]] },
  { id: 'thanh_long', name: 'Thanh long', cat: 'drought', min: 20, target: 40, max: 65, win: [[5, 8], [16, 18]] },
  { id: 'cay_con', name: 'Cây con / mới trồng', cat: 'seedling', min: 45, target: 60, max: 80, win: [[5, 8], [11, 11], [16, 18]] }
];

// Mẫu nhanh theo mùa (prefill chế độ Cảm biến)
const SEASONS = { dry: '☀️ Mùa khô', rainy: '🌧 Mùa mưa', transition: '🍃 Giao mùa' };
const CROPS = { leafy: '🥬 Rau ăn lá', fruit: '🌳 Cây ăn quả', greenhouse: '🏠 Nhà màng' };
const TEMPLATES = {
  dry: { leafy: [45, 15, 4], fruit: [50, 30, 2], greenhouse: [55, 10, 5] },
  rainy: { leafy: [35, 10, 2], fruit: [30, 15, 1], greenhouse: [45, 10, 3] },
  transition: { leafy: [40, 12, 3], fruit: [40, 20, 2], greenhouse: [50, 10, 4] }
};

const PRIO = { low: 1, medium: 2, high: 3 };

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

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
      <div class="card-meta">App soạn — <strong>bộ điều khiển tại trại thực thi</strong> (điện thoại tắt / mất mạng vẫn chạy). Khung giờ = lúc được tưới; ngoài khung tự tránh (vd không tưới trưa 11–15h). Chế độ <strong>Theo cây</strong> để WLC tự tính lượng nước bằng ETo/Kc theo loại cây + giai đoạn. An toàn: ≤ ${MAX_DURATION_MIN} phút/lần, ≤ ${MAX_RUNS_PER_DAY} lần/ngày.</div>
    </div>

    <div class="card">
      <div class="card-title" style="font-size:14px;">⚡ Mẫu nhanh theo mùa</div>
      <div class="card-meta" style="margin-bottom:8px;">Chọn mùa + loại cây → điền sẵn chế độ "Theo cảm biến".</div>
      <div style="display:flex; gap:8px;">
        <select id="tpl-season" style="flex:1;">${Object.entries(SEASONS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <select id="tpl-crop" style="flex:1;">${Object.entries(CROPS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      </div>
      <button id="tpl-apply" class="btn secondary" style="margin-top:8px; width:100%;">Áp dụng mẫu</button>
    </div>

    <div class="form" style="padding-top:0;">
      <details id="rule-create-box">
        <summary class="btn" style="display:block; text-align:center; cursor:pointer; list-style:none;">＋ Tạo quy tắc tưới</summary>
        <form id="rule-form" style="margin-top:12px;">
          <label>Chế độ tưới *</label>
          <select name="mode" id="rule-mode">${Object.entries(MODES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>

          <label>Tên quy tắc *</label>
          <input name="name" required placeholder="VD: Tưới rau sáng khi đất khô" />

          <label>Vùng / Zone *</label>
          <input name="zoneId" placeholder="VD: zone_a / Z1" required />

          <!-- ĐIỀU KIỆN cảm biến (comparison, schedule_and_condition) -->
          <div class="rfields" data-m="comparison schedule_and_condition">
            <label>NẾU cảm biến</label>
            <div style="display:flex; gap:8px;">
              <select name="sensor" style="flex:2;">${Object.entries(SENSORS).map(([k, m]) => `<option value="${k}">${m.label}</option>`).join('')}</select>
              <select name="op" style="flex:1;"><option value="<">&lt;</option><option value=">">&gt;</option></select>
              <input name="threshold" type="number" step="0.1" placeholder="Ngưỡng" style="flex:1;" />
            </div>
          </div>

          <!-- KHUNG GIỜ tưới (mọi chế độ rule) -->
          <div class="rfields" data-m="comparison schedule schedule_and_condition">
            <label style="margin-top:10px;">Khung giờ được tưới (ngoài khung = không tưới)</label>
            <div style="display:flex; gap:8px; align-items:center;">
              <label style="flex:0 0 auto; display:flex; gap:4px; align-items:center;"><input type="checkbox" name="winM" checked /> Sáng</label>
              <input name="winMfrom" type="number" min="0" max="23" value="6" style="flex:1;" /><span>→</span>
              <input name="winMto" type="number" min="0" max="23" value="9" style="flex:1;" /><span style="font-size:12px;color:var(--c-text-muted);">h</span>
            </div>
            <div style="display:flex; gap:8px; align-items:center; margin-top:6px;">
              <label style="flex:0 0 auto; display:flex; gap:4px; align-items:center;"><input type="checkbox" name="winA" checked /> Chiều</label>
              <input name="winAfrom" type="number" min="0" max="23" value="16" style="flex:1;" /><span>→</span>
              <input name="winAto" type="number" min="0" max="23" value="18" style="flex:1;" /><span style="font-size:12px;color:var(--c-text-muted);">h</span>
            </div>
            <div style="font-size:12px; color:#2E7D32; margin-top:4px;">✓ Chỉ tưới sáng &amp; chiều → tự động không tưới trưa nắng.</div>
          </div>

          <!-- HÀNH ĐỘNG bơm (rule modes) -->
          <div class="rfields" data-m="comparison schedule schedule_and_condition">
            <label style="margin-top:10px;">THÌ bật thiết bị</label>
            <input name="deviceId" placeholder="Relay/bơm (VD: relay_001)" />
            <div style="display:flex; gap:8px; margin-top:6px;">
              <input name="durationMin" type="number" min="1" max="${MAX_DURATION_MIN}" value="15" style="flex:1;" />
              <span style="align-self:center; font-size:13px; color:var(--c-text-muted);">phút/lần</span>
              <input name="maxPerDay" type="number" min="1" max="${MAX_RUNS_PER_DAY}" value="3" style="flex:1;" />
              <span style="align-self:center; font-size:13px; color:var(--c-text-muted);">lần/ngày</span>
            </div>
            <div style="display:flex; gap:8px; margin-top:6px;">
              <input name="cooldownMin" type="number" min="5" max="720" value="30" style="flex:1;" />
              <span style="align-self:center; font-size:13px; color:var(--c-text-muted);">phút nghỉ</span>
              <select name="priority" style="flex:1;"><option value="low">Ưu tiên thấp</option><option value="medium" selected>Vừa</option><option value="high">Cao</option></select>
            </div>
          </div>

          <!-- CHẾ ĐỘ THEO CÂY (crop) -->
          <div class="rfields" data-m="crop">
            <label style="margin-top:10px;">Loại cây (hồ sơ tưới)</label>
            <select name="cropId" id="rule-crop">${CROP_CATALOG.map(c => `<option value="${c.id}">${esc(c.name)} (${c.cat})</option>`).join('')}</select>
            <label>Relay (pin) gắn vùng</label>
            <input name="relayPin" type="number" min="0" max="40" placeholder="Số chân relay (VD: 26)" />
            <div id="crop-reco" style="font-size:12px; color:var(--c-text-muted); margin-top:4px;"></div>
            <details style="margin-top:8px;">
              <summary style="cursor:pointer; font-size:13px; color:var(--c-text-muted);">⚙ Tùy chỉnh ngưỡng ẩm (mặc định theo cây)</summary>
              <div style="display:flex; gap:8px; margin-top:8px;">
                <div style="flex:1;"><label style="font-size:12px;">Tối thiểu</label><input name="cMin" type="number" min="0" max="100" style="width:100%;" /></div>
                <div style="flex:1;"><label style="font-size:12px;">Mục tiêu</label><input name="cTarget" type="number" min="0" max="100" style="width:100%;" /></div>
                <div style="flex:1;"><label style="font-size:12px;">Tối đa</label><input name="cMax" type="number" min="0" max="100" style="width:100%;" /></div>
              </div>
              <div style="font-size:12px; color:#ef6c00; margin-top:4px;">Để trống = dùng ngưỡng khuyến nghị của cây. WLC tự tính lượng nước (ETo×Kc) theo giai đoạn sinh trưởng.</div>
            </details>
          </div>

          <div id="rule-err" style="display:none; background:#ffebee; border:1px solid #ef9a9a; color:#c62828; border-radius:8px; padding:9px 12px; margin-top:10px; font-size:13px; font-weight:600;"></div>
          <button type="submit" class="btn" style="margin-top:14px;">Lưu quy tắc</button>
        </form>
      </details>
    </div>

    <h3 style="padding:14px 16px 4px; color:var(--c-text-muted); font-size:13px; text-transform:uppercase;">Quy tắc (${rules.length})</h3>
    ${rules.length === 0 ? `<div class="empty" style="padding:20px;"><p>Chưa có quy tắc. Dùng "Mẫu nhanh theo mùa" hoặc tạo theo cây.</p></div>` : ''}
    ${rules.map(r => `
      <div class="card">
        <div class="row">
          <div class="card-title">${esc(r.name)}</div>
          <span class="pill ${r.enabled ? 'completed' : ''}">${r.enabled ? 'Đang bật' : 'Tạm tắt'}</span>
        </div>
        <div class="card-meta" style="margin-top:4px;">${MODES[r.mode] || r.mode}<br/>${esc(r.summary || '')}</div>
        <div class="card-meta">${r.synced ? '✓ Đã đồng bộ bộ điều khiển' : '⏳ Chờ đồng bộ khi kết nối'}</div>
        <div style="margin-top:8px; display:flex; gap:8px;">
          <button data-rule-toggle="${esc(r.id)}" class="btn secondary" style="flex:1; padding:6px;">${r.enabled ? 'Tạm tắt' : 'Bật lại'}</button>
          <button data-rule-del="${esc(r.id)}" class="btn danger" style="flex:1; padding:6px;">Xoá</button>
        </div>
      </div>`).join('')}
  `;
}

// Lấy windows [{start,end}] từ form
function readWindows(form) {
  const w = [];
  if (form.winM && form.winM.checked) w.push({ start: clampH(form.winMfrom.value), end: clampH(form.winMto.value) });
  if (form.winA && form.winA.checked) w.push({ start: clampH(form.winAfrom.value), end: clampH(form.winAto.value) });
  return w;
}
function clampH(v) { return Math.min(23, Math.max(0, parseInt(v, 10) || 0)); }

window.wire_rules = function () {
  const nav = () => document.querySelector('[x-data]').__x.$data.nav('rules');
  const toast = (m, t) => window.showToast && window.showToast(m, t || '');
  const showErr = m => { const e = document.getElementById('rule-err'); if (e) { e.textContent = '⚠ ' + m; e.style.display = 'block'; } else toast('✗ ' + m, 'err'); };

  // Hiện/ẩn nhóm field theo chế độ
  const modeSel = document.getElementById('rule-mode');
  const refreshMode = () => {
    const m = modeSel.value;
    document.querySelectorAll('.rfields').forEach(el => { el.style.display = el.dataset.m.split(' ').includes(m) ? 'block' : 'none'; });
  };
  modeSel?.addEventListener('change', refreshMode); refreshMode();

  // Gợi ý ngưỡng theo cây
  const cropSel = document.getElementById('rule-crop');
  const reco = document.getElementById('crop-reco');
  const refreshCrop = () => {
    const c = CROP_CATALOG.find(x => x.id === cropSel.value); if (!c || !reco) return;
    reco.textContent = `Khuyến nghị: ẩm ${c.min}–${c.target}–${c.max}% · khung ${c.win.map(w => w[0] + '-' + w[1] + 'h').join(', ')}`;
  };
  cropSel?.addEventListener('change', refreshCrop); refreshCrop();

  // Mẫu nhanh theo mùa → prefill comparison
  document.getElementById('tpl-apply')?.addEventListener('click', () => {
    const season = document.getElementById('tpl-season').value;
    const crop = document.getElementById('tpl-crop').value;
    const [threshold, duration, perDay] = (TEMPLATES[season] || {})[crop] || [40, 15, 3];
    const form = document.getElementById('rule-form');
    const box = document.getElementById('rule-create-box');
    if (!form || !box) return;
    box.open = true;
    form.mode.value = 'comparison'; refreshMode();
    form.name.value = `Tưới ${CROPS[crop].replace(/^\S+\s/, '')} — ${SEASONS[season].replace(/^\S+\s/, '')}`;
    form.sensor.value = 'soil_moisture'; form.op.value = '<';
    form.threshold.value = threshold; form.durationMin.value = duration; form.maxPerDay.value = perDay;
    form.zoneId.focus();
    toast(`✓ Đã điền mẫu: đất < ${threshold}% → tưới ${duration}', ${perDay} lần/ngày. Điền Zone + bơm rồi lưu.`, 'ok');
  });

  document.getElementById('rule-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const mode = f.mode.value;
    const name = (f.name.value || '').trim();
    const zoneId = (f.zoneId.value || '').trim();
    if (!name || !zoneId) { showErr('Cần tên quy tắc + Zone'); return; }
    const id = `${PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const site = authStore.activeFarmId || 'F1';

    try {
      if (mode === 'crop') {
        // ===== Theo cây: cấu hình ZONE (+CROP nếu sửa ngưỡng) =====
        const tpl = CROP_CATALOG.find(x => x.id === f.cropId.value) || CROP_CATALOG[0];
        const relayPin = f.relayPin.value === '' ? null : parseInt(f.relayPin.value, 10);
        const cMin = f.cMin.value, cTarget = f.cTarget.value, cMax = f.cMax.value;
        const customized = cMin !== '' || cTarget !== '' || cMax !== '';
        let cropId = tpl.id;
        if (customized) {
          cropId = 'cz_' + zoneId.replace(/[^A-Za-z0-9_]/g, '');
          const cropBody = {
            crop_id: cropId, name: tpl.name + ' · ' + zoneId, category: tpl.cat,
            min_soil_moisture: cMin !== '' ? parseFloat(cMin) : tpl.min,
            target_soil_moisture: cTarget !== '' ? parseFloat(cTarget) : tpl.target,
            max_soil_moisture: cMax !== '' ? parseFloat(cMax) : tpl.max,
            irrigation_windows: tpl.win.map(w => ({ start: w[0], end: w[1] }))
          };
          await syncQueue.enqueue({ path: '/api/irrigation/crops', method: 'POST', body: JSON.stringify(cropBody) });
        }
        const zoneBody = { zone_id: zoneId, site_id: site, crop_id: cropId, relay_pin: relayPin, name, enabled: 1 };
        await syncQueue.enqueue({ path: '/api/irrigation/zones', method: 'POST', body: JSON.stringify(zoneBody) });
        const summary = `Cây: ${tpl.name}${customized ? ' (tùy chỉnh ẩm)' : ''} · Zone ${zoneId} · relay ${relayPin ?? '-'} · WLC tự tính ETo/Kc`;
        await set(id, { kind: 'zone', refId: zoneId, name, enabled: true, synced: false, createdAt: Date.now(), mode, summary, payload: zoneBody, deleteBase: '/api/irrigation/zones' });
        toast('✓ Đã lưu cấu hình tưới theo cây — sẽ đồng bộ', 'ok'); nav(); return;
      }

      // ===== Các chế độ RULE (comparison / schedule / schedule_and_condition) =====
      const deviceId = (f.deviceId.value || '').trim();
      if (!deviceId) { showErr('Cần thiết bị (relay/bơm)'); return; }
      const durationMin = parseInt(f.durationMin.value, 10);
      const maxPerDay = parseInt(f.maxPerDay.value, 10);
      if (!(durationMin >= 1 && durationMin <= MAX_DURATION_MIN)) { showErr(`Thời lượng 1–${MAX_DURATION_MIN} phút`); return; }
      if (!(maxPerDay >= 1 && maxPerDay <= MAX_RUNS_PER_DAY)) { showErr(`Tối đa ${MAX_RUNS_PER_DAY} lần/ngày`); return; }
      const windows = readWindows(f);

      let trigger, condSummary = '';
      if (mode === 'comparison' || mode === 'schedule_and_condition') {
        const sensor = f.sensor.value, op = f.op.value, sm = SENSORS[sensor];
        const threshold = parseFloat(f.threshold.value);
        if (isNaN(threshold) || threshold < sm.min || threshold > sm.max) { showErr(`Ngưỡng ${sm.label} phải trong ${sm.min}–${sm.max}${sm.unit}`); return; }
        const condition = { type: 'comparison', sensor, operator: op, value: threshold };
        condSummary = `${sm.label} ${op} ${threshold}${sm.unit}`;
        trigger = mode === 'comparison'
          ? condition
          : { type: 'schedule_and_condition', schedule: { days: '*' }, condition };
      } else {
        trigger = { type: 'schedule', schedule: { days: '*' } };
      }
      const cooldownMin = Math.min(720, Math.max(5, parseInt(f.cooldownMin.value, 10) || 30));
      const winSummary = windows.length ? windows.map(w => w.start + '-' + w.end + 'h').join(', ') : 'mọi lúc';

      const ruleBody = {
        rule_id: id, zone_id: zoneId, model_type: 'irrigation', name, enabled: true,
        priority: PRIO[f.priority.value] || 2, cooldown_sec: cooldownMin * 60,
        trigger,
        action: { target: deviceId, command: 'on_for', durationSec: durationMin * 60 },
        constraints: { windows, maxPerDay }
      };
      await syncQueue.enqueue({ path: '/api/automation/rules', method: 'POST', body: JSON.stringify(ruleBody) });
      const summary = `${condSummary ? 'NẾU ' + condSummary + ' · ' : ''}bật ${deviceId} ${durationMin}'· khung ${winSummary} · ≤${maxPerDay}/ngày`;
      await set(id, { kind: 'automation', refId: id, name, enabled: true, synced: false, createdAt: Date.now(), mode, summary, payload: ruleBody, deleteBase: '/api/automation/rules' });
      toast('✓ Đã lưu — sẽ đồng bộ xuống bộ điều khiển', 'ok'); nav();
    } catch (err) { showErr(err.message); }
  });

  // Bật/tắt
  document.querySelectorAll('[data-rule-toggle]').forEach(b => b.addEventListener('click', async () => {
    const r = await get(b.dataset.ruleToggle); if (!r) return;
    r.enabled = !r.enabled; r.synced = false;
    await set(b.dataset.ruleToggle, r);
    if (r.payload && r.deleteBase) {
      if (r.kind === 'zone') r.payload.enabled = r.enabled ? 1 : 0; else r.payload.enabled = r.enabled;
      await syncQueue.enqueue({ path: r.deleteBase, method: 'POST', body: JSON.stringify(r.payload) });
    }
    nav();
  }));

  // Xoá
  document.querySelectorAll('[data-rule-del]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Xoá quy tắc này? Bộ điều khiển sẽ ngừng thực thi sau khi đồng bộ.')) return;
    const r = await get(b.dataset.ruleDel); if (!r) return;
    await del(b.dataset.ruleDel);
    if (r.deleteBase && r.refId) await syncQueue.enqueue({ path: r.deleteBase + '/' + encodeURIComponent(r.refId), method: 'DELETE', body: '{}' });
    toast('Đã xoá — chờ đồng bộ', '');
    nav();
  }));
};
