import { seasonStore, suggestRotation, getCropFamily } from '../stores/season.js';
import { lotStore } from '../db/trace.js';

const MONTHS = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];
const MONTH_LABELS = ['Thg 1','Thg 2','Thg 3','Thg 4','Thg 5','Thg 6','Thg 7','Thg 8','Thg 9','Thg 10','Thg 11','Thg 12'];

export async function renderSeasonal() {
  const plans = await seasonStore.list();
  const lots = await lotStore.list();
  const zones = [...new Set([...plans.map(p => p.zoneId), ...lots.filter(l => l.zoneId).map(l => l.zoneId)])].sort();

  const now = new Date();
  const year = now.getFullYear();
  const thisYear = year;

  let html = `
    <div class="app-header">📅 Lịch mùa vụ & Luân canh
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('more')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>

    <div class="form" style="padding-bottom:0;">
      <details>
        <summary class="btn" style="display:block;text-align:center;cursor:pointer;list-style:none;">＋ Thêm kế hoạch mùa vụ</summary>
        <form id="season-form" style="margin-top:12px;">
          <label>Tên kế hoạch (VD: Vụ Đông Xuân 2026)</label>
          <input name="name" placeholder="Mặc định = cây trồng + zone" />
          <label>Cây trồng *</label>
          <input name="crop" id="season-crop" list="crop-list" required placeholder="Lúa, rau muống, cà chua..." />
          <label>Giống</label>
          <input name="variety" placeholder="Giống/xuất xứ" />
          <label>Zone *</label>
          <input name="zoneId" list="zone-list" required placeholder="Z1, Z2..." />
          <label>Diện tích</label>
          <input name="area" placeholder="500 m², 0.2 ha..." />
          <label>Tháng bắt đầu (dự kiến)</label>
          <input name="plannedAt" type="month" value="${thisYear}-${String(now.getMonth() + 1).padStart(2, '0')}" />
          <label>Sản lượng kỳ vọng</label>
          <input name="expectedYield" placeholder="KG" />
          <label>Doanh thu kỳ vọng (VND)</label>
          <input name="expectedRevenue" placeholder="VD: 50000000" />
          <label>Ghi chú</label>
          <textarea name="note"></textarea>
          <div id="season-rotation-advice" style="font-size:13px;color:#2E7D32;margin:6px 0;"></div>
          <button type="submit" class="btn" style="margin-top:10px;">Lưu kế hoạch</button>
        </form>
      </details>
    </div>

    ${zones.length === 0 ? `<div class="empty"><p>Chưa có zone nào. Tạo kế hoạch mùa vụ để bắt đầu.</p></div>` : ''}

    <h3 style="padding:14px 16px 4px;color:var(--c-text-muted);font-size:13px;text-transform:uppercase;">Sơ đồ canh tác · ${year}</h3>
  `;

  for (const zoneId of zones) {
    html += renderZoneGantt(zoneId, plans, lots, year);
  }

  html += `<h3 style="padding:14px 16px 4px;color:var(--c-text-muted);font-size:13px;text-transform:uppercase;">Gợi ý luân canh</h3>`;

  for (const zoneId of zones) {
    const advice = await seasonStore.rotateAdviceForZone(zoneId);
    if (advice.lastCrop) {
      html += `
      <div class="card">
        <div class="card-title">Zone ${zoneId}</div>
        <div class="row">
          <div>🌱 Vụ trước: <strong>${advice.lastCrop}</strong></div>
          <span style="font-size:20px;">→</span>
          <div>💡 Nên trồng: ${advice.suggestions.length > 0
            ? advice.suggestions.slice(0, 5).map(s => `<span class="pill completed">${s.crop}</span>`).join(' ')
            : '<span class="card-meta">Chưa xác định — thử cây họ đậu hoặc cải</span>'}</div>
        </div>
      </div>`;
    }
  }

  // Risk assessment
  html += `<h3 style="padding:14px 16px 4px;color:var(--c-text-muted);font-size:13px;text-transform:uppercase;">⚠ Đánh giá rủi ro hạn · ngập</h3>`;
  try {
    const { riskStore } = await import('../stores/risk.js');
    const risks = await riskStore.assessAll();
    for (const r of risks) {
      const dColor = r.drought.risk === 'high' ? '#c62828' : r.drought.risk === 'medium' ? '#F57F17' : '#2E7D32';
      const fColor = r.flood.risk === 'high' ? '#c62828' : r.flood.risk === 'medium' ? '#F57F17' : '#2E7D32';
      html += `
      <div class="card">
        <div class="card-title">📍 Zone ${r.zoneId}</div>
        <div style="display:flex;gap:16px;margin-top:4px;">
          <div style="flex:1;padding:8px;border-radius:6px;background:${dColor}15;border:1px solid ${dColor}30;">
            <div style="font-size:12px;font-weight:600;color:${dColor};">🔥 Hạn hán</div>
            <div style="font-size:11px;margin-top:2px;">${r.drought.reason}</div>
          </div>
          <div style="flex:1;padding:8px;border-radius:6px;background:${fColor}15;border:1px solid ${fColor}30;">
            <div style="font-size:12px;font-weight:600;color:${fColor};">🌊 Ngập úng</div>
            <div style="font-size:11px;margin-top:2px;">${r.flood.reason}</div>
          </div>
        </div>
        ${r.activeCrops.length > 0 ? `<div class="card-meta" style="margin-top:4px;">🌱 ${r.activeCrops.map(c => c.crop).join(', ')}</div>` : ''}
      </div>`;
    }
  } catch (_) { html += `<div class="card"><div class="card-meta">Không thể đánh giá rủi ro (thiếu dữ liệu)</div></div>`; }

  // Crop family reference
  html += `
    <details style="margin:12px 16px;">
      <summary style="cursor:pointer;font-size:13px;font-weight:600;list-style:none;">📖 Bảng họ cây trồng tham khảo</summary>
      <div style="font-size:12px;margin:8px 0;display:flex;flex-wrap:wrap;gap:12px;">
        <div><strong>Poaceae:</strong> Lúa, ngô<br><strong>Brassicaceae:</strong> Cải, bông cải, su hào<br><strong>Solanaceae:</strong> Cà chua, ớt, cà tím, khoai tây<br><strong>Cucurbitaceae:</strong> Dưa, bí, mướp, bầu, khổ qua</div>
        <div><strong>Fabaceae (đậu):</strong> Đậu xanh, nành, phộng<br><strong>Alliaceae:</strong> Hành, tỏi, kiệu<br><strong>Convolvulaceae:</strong> Rau muống<br><strong>Rutaceae:</strong> Cam, quýt, chanh, bưởi</div>
      </div>
    </details>

    <div class="card" style="background:#FFFDE7;">
      <div class="card-title">📋 Nguyên tắc luân canh cơ bản</div>
      <ul style="margin:4px 0 0;padding-left:20px;font-size:13px;">
        <li>Không trồng cùng họ liên tiếp (dễ tích luỹ sâu bệnh)</li>
        <li>Sau cây họ đậu → đất giàu đạm, tốt cho hầu hết cây trồng</li>
        <li>Sau solanaceae → nên trồng cây họ cải hoặc đậu để cắt vòng bệnh</li>
        <li>Sau lúa nước → trồng rau màu cạn để cải tạo đất</li>
        <li>Luân canh lúa - màu - lúa: mô hình bền vững nhất ĐBSCL</li>
      </ul>
    </div>
  `;

  return html;
}

function renderZoneGantt(zoneId, plans, lots, year) {
  const zonePlans = plans.filter(p => p.zoneId === zoneId && p.status !== 'cancelled');
  const zoneLots = lots.filter(l => l.zoneId === zoneId && l.status !== 'closed');

  let rowsHtml = '';
  const CM = 100 / 12;

  for (const p of zonePlans) {
    const startMonth = parseInt((p.plannedAt || '01').split('-')[1], 10) || 1;
    const colStart = (startMonth - 1) * (100 / 12);
    const barWidth = CM * 4;
    const family = getCropFamily(p.crop);
    const color = familyColor(family);
    rowsHtml += `
      <div style="display:flex;align-items:center;height:32px;margin:2px 0;position:relative;">
        <span style="width:100px;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0;">
          <strong>${p.crop}</strong>${p.variety ? ' ' + p.variety : ''}
        </span>
        <div style="flex:1;position:relative;height:100%;background:#f0f0f0;border-radius:4px;overflow:hidden;">
          <div style="position:absolute;left:${colStart}%;width:${barWidth}%;height:100%;background:${color};border-radius:4px;opacity:0.7;"></div>
          <span style="position:absolute;left:${colStart + 1}%;font-size:10px;line-height:32px;color:#111;white-space:nowrap;">${p.status === 'planned' ? '🔜' : '🌱'} ${p.crop}</span>
        </div>
        <span style="width:60px;font-size:10px;text-align:right;flex-shrink:0;color:var(--c-text-muted);">
          <button class="btn small" style="font-size:10px;padding:1px 6px;" onclick="window.seasonDelete('${p.id}')">✕</button>
        </span>
      </div>`;
  }

  for (const l of zoneLots) {
    const plantMonth = parseInt((l.plantedAt || '2026-01').split('-')[1], 10);
    const colStart = (plantMonth - 1) * CM;
    const family = getCropFamily(l.crop);
    const color = familyColor(family);
    const label = l.status === 'growing' ? '🌱' : '✓';
    rowsHtml += `
      <div style="display:flex;align-items:center;height:32px;margin:2px 0;position:relative;">
        <span style="width:100px;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0;">
          <strong>${l.crop}</strong>
        </span>
        <div style="flex:1;position:relative;height:100%;background:#f0f0f0;border-radius:4px;overflow:hidden;">
          <div style="position:absolute;left:${colStart}%;width:${CM * 4}%;height:100%;background:${color};border-radius:4px;opacity:0.5;"></div>
          <span style="position:absolute;left:${colStart + 1}%;font-size:10px;line-height:32px;color:#111;white-space:nowrap;">${label} ${l.code}</span>
        </div>
      </div>`;
  }

  if (!rowsHtml) {
    rowsHtml = `<div style="padding:8px;font-size:12px;color:var(--c-text-muted);">Chưa có kế hoạch cho zone này</div>`;
  }

  const headerCells = MONTH_LABELS.slice(0, 12).map(m => `<div style="flex:1;font-size:11px;color:var(--c-text-muted);text-align:center;">${m}</div>`).join('');

  return `
    <div class="card" style="overflow-x:auto;">
      <div class="card-title">📍 Zone ${zoneId}</div>
      <div style="display:flex;margin:8px 0 4px;padding-left:100px;">${headerCells}</div>
      ${rowsHtml}
    </div>`;
}

function familyColor(family) {
  const colors = {
    'poaceae_rice': '#81C784',
    'poaceae_corn': '#A5D6A7',
    'brassicaceae': '#4FC3F7',
    'solanaceae': '#EF5350',
    'cucurbitaceae': '#FFB74D',
    'fabaceae': '#66BB6A',
    'alliaceae': '#CE93D8',
    'convolvulaceae': '#4DB6AC',
    'rutaceae': '#FFA726',
    'anacardiaceae': '#FF8A65',
  };
  return colors[family] || '#90A4AE';
}

window.seasonDelete = async (id) => {
  if (!confirm('Xoá kế hoạch này?')) return;
  await seasonStore.remove(id);
  document.querySelector('[x-data]').__x.$data.nav('seasonal');
};

window.wire_seasonal = function() {
  let zoneCache = null;
  document.getElementById('season-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await seasonStore.create({
        name: fd.get('name'), crop: fd.get('crop'), variety: fd.get('variety'),
        zoneId: fd.get('zoneId'), area: fd.get('area'),
        plannedAt: fd.get('plannedAt'), expectedYield: fd.get('expectedYield'),
        expectedRevenue: fd.get('expectedRevenue'), note: fd.get('note')
      });
      window.showToast?.('✓ Đã lưu kế hoạch', 'ok');
      document.querySelector('[x-data]').__x.$data.nav('seasonal');
    } catch (err) { window.showToast?.('✗ ' + err.message, 'err'); }
  });

  document.getElementById('season-crop')?.addEventListener('input', async function() {
    const advice = document.getElementById('season-rotation-advice');
    const crop = this.value.trim();
    if (!crop) { advice.textContent = ''; return; }
    const family = getCropFamily(crop);
    if (!family) { advice.textContent = '⚠ Chưa có dữ liệu họ cây này. Vui lòng kiểm tra lại.'; return; }
    const sug = suggestRotation(crop);
    advice.innerHTML = sug.length > 0
      ? `🌿 Sau vụ này, nên trồng: ${sug.slice(0, 5).map(s => `<strong>${s.crop}</strong>`).join(', ')}`
      : '🌿 Sau vụ này, thử cây họ đậu hoặc cải để cắt vòng sâu bệnh.';
  });

  // Zone datalist từ lot hiện có
  (async () => {
    const { lotStore } = await import('../db/trace.js');
    const lots = await lotStore.list();
    const zones = [...new Set(lots.filter(l => l.zoneId).map(l => l.zoneId))].sort();
    const dl = document.getElementById('zone-list') || document.createElement('datalist');
    dl.id = 'zone-list';
    dl.innerHTML = zones.map(z => `<option value="${z}">`).join('');
    document.querySelector('[name="zoneId"]')?.setAttribute('list', 'zone-list');
    document.body.appendChild(dl);

    const cl = document.getElementById('crop-list') || document.createElement('datalist');
    cl.id = 'crop-list';
    const crops = [...new Set(lots.filter(l => l.crop).map(l => l.crop.toLowerCase()))].sort();
    cl.innerHTML = crops.map(c => `<option value="${c}">`).join('');
    document.body.appendChild(cl);
  })();
};
