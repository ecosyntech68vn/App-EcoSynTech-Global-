import { soilStore, SOIL_TEXTURES } from '../stores/soil.js';

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

export async function renderSoil() {
  const all = await soilStore.getAll();
  const summary = await soilStore.getSummary();
  const zones = [...new Set(all.map(s => s.zoneId))];

  return `
    <div class="app-header">🌱 Thổ nhưỡng
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('more')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>

    <div style="display:flex;gap:6px;padding:10px 16px;flex-wrap:wrap;">
      <div class="card" style="flex:1;padding:8px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:#1565C0;">${summary.zoneCount}</div>
        <div style="font-size:10px;color:var(--c-text-muted);">Zone đã lấy mẫu</div>
      </div>
      <div class="card" style="flex:1;padding:8px;text-align:center;">
        <div style="font-size:20px;font-weight:800;">${summary.total}</div>
        <div style="font-size:10px;color:var(--c-text-muted);">Tổng mẫu</div>
      </div>
      <div class="card" style="flex:1;padding:8px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:#2E7D32;">${summary.avgPh}</div>
        <div style="font-size:10px;color:var(--c-text-muted);">pH trung bình</div>
      </div>
    </div>

    <div style="padding:0 16px 8px;">
      <button class="btn primary" style="width:100%;font-size:13px;" onclick="window.soilShowForm()">➕ Thêm mẫu đất</button>
    </div>

    <div id="soil-add-form" style="display:none;padding:12px;margin:0 16px 8px;border:2px solid #5D4037;border-radius:10px;">
      <div style="font-weight:700;margin-bottom:8px;">🧪 Thêm mẫu đất</div>
      <input id="soil-zone" class="form" placeholder="Zone * (vd: Z1)" />
      <input id="soil-depth" class="form" type="number" placeholder="Độ sâu (cm)" step="5" />
      <div style="display:flex;gap:4px;flex-wrap:wrap;">
        <input id="soil-ph" class="form" type="number" placeholder="pH" step="0.1" min="0" max="14" style="flex:1;" />
        <input id="soil-n" class="form" type="number" placeholder="N (mg/kg)" step="1" style="flex:1;" />
        <input id="soil-p" class="form" type="number" placeholder="P (mg/kg)" step="1" style="flex:1;" />
        <input id="soil-k" class="form" type="number" placeholder="K (mg/kg)" step="1" style="flex:1;" />
      </div>
      <div style="display:flex;gap:4px;">
        <input id="soil-om" class="form" type="number" placeholder="Chất hữu cơ %" step="0.1" style="flex:1;" />
        <input id="soil-moist" class="form" type="number" placeholder="Ẩm độ %" step="1" style="flex:1;" />
      </div>
      <select id="soil-texture" class="form">${SOIL_TEXTURES.map(t => `<option value="${t.id}">${esc(t.label)}</option>`).join('')}</select>
      <textarea id="soil-notes" class="form" placeholder="Ghi chú (màu sắc, kết cấu...)" rows="2"></textarea>
      <button class="btn primary" style="width:100%;margin-top:6px;" onclick="window.soilAdd()">💾 Lưu mẫu</button>
      <button class="btn secondary" style="width:100%;margin-top:4px;" onclick="document.getElementById('soil-add-form').style.display='none'">Hủy</button>
    </div>

    <h3 style="padding:8px 16px 2px;font-size:13px;color:var(--c-text-muted);text-transform:uppercase;">Mẫu gần đây</h3>
    ${all.length === 0
      ? '<div class="empty" style="padding:20px;"><div class="ico">🌱</div><p>Chưa có mẫu đất nào. Bắt đầu lấy mẫu để theo dõi chất lượng đất.</p></div>'
      : all.slice(0, 30).map(s => {
          const txt = SOIL_TEXTURES.find(t => t.id === s.texture);
          return `<div class="card" style="padding:10px;">
            <div class="row">
              <div>
                <span style="font-weight:600;">📌 ${esc(s.zoneId)}</span>
                <span style="font-size:12px;color:var(--c-text-muted);margin-left:6px;">${s.date} · ${s.depth}cm</span>
              </div>
              <button class="btn small danger" onclick="window.soilDel('${s.id}')" style="padding:2px 6px;font-size:11px;">✕</button>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;font-size:12px;">
              ${s.ph != null ? `<span style="background:#E8F5E9;padding:1px 6px;border-radius:4px;">pH ${s.ph}</span>` : ''}
              ${s.n != null ? `<span style="background:#E3F2FD;padding:1px 6px;border-radius:4px;">N ${s.n}</span>` : ''}
              ${s.p != null ? `<span style="background:#FFF3E0;padding:1px 6px;border-radius:4px;">P ${s.p}</span>` : ''}
              ${s.k != null ? `<span style="background:#F3E5F5;padding:1px 6px;border-radius:4px;">K ${s.k}</span>` : ''}
              ${s.organicMatter != null ? `<span style="background:#EFEBE9;padding:1px 6px;border-radius:4px;">OM ${s.organicMatter}%</span>` : ''}
              ${txt ? esc(txt.label) : ''}
            </div>
            ${s.notes ? `<div style="font-size:11px;color:var(--c-text-muted);margin-top:2px;">📝 ${esc(s.notes)}</div>` : ''}
          </div>`;
        }).join('')}

    ${zones.length > 1 ? `
    <h3 style="padding:8px 16px 2px;margin-top:4px;font-size:13px;color:var(--c-text-muted);text-transform:uppercase;">So sánh theo Zone</h3>
    <div style="padding:0 16px 16px;">
      <select id="soil-compare-zone" class="form" onchange="window.soilShowHistory()">
        <option value="">-- Chọn zone --</option>
        ${zones.map(z => `<option value="${z}">${esc(z)}</option>`).join('')}
      </select>
      <div id="soil-history" style="margin-top:8px;"></div>
    </div>` : ''}
  `;
}

window.soilShowForm = () => {
  document.getElementById('soil-add-form').style.display = 'block';
};

window.soilAdd = async () => {
  const zone = document.getElementById('soil-zone')?.value;
  if (!zone) { window.showToast?.('Nhập Zone', 'err'); return; }
  await soilStore.add({
    zoneId: zone,
    depth: document.getElementById('soil-depth')?.value || 0,
    ph: document.getElementById('soil-ph')?.value,
    n: document.getElementById('soil-n')?.value,
    p: document.getElementById('soil-p')?.value,
    k: document.getElementById('soil-k')?.value,
    organicMatter: document.getElementById('soil-om')?.value,
    moisture: document.getElementById('soil-moist')?.value,
    texture: document.getElementById('soil-texture')?.value || '',
    notes: document.getElementById('soil-notes')?.value || ''
  });
  window.showToast?.('✓ Đã thêm mẫu đất', 'ok');
  document.querySelector('[x-data]').__x?.$data?.nav?.('soil');
};

window.soilDel = async (id) => {
  if (!confirm('Xóa mẫu này?')) return;
  await soilStore.delete(id);
  document.querySelector('[x-data]').__x?.$data?.nav?.('soil');
};

window.soilShowHistory = async () => {
  const zone = document.getElementById('soil-compare-zone')?.value;
  if (!zone) { document.getElementById('soil-history').innerHTML = ''; return; }
  const history = await soilStore.getHistory(zone);
  if (!history) { document.getElementById('soil-history').innerHTML = '<div class="card-meta">Không có dữ liệu.</div>'; return; }
  const h = history.average;
  document.getElementById('soil-history').innerHTML = `
    <div class="card" style="padding:10px;border-color:#5D4037;">
      <div style="font-weight:600;margin-bottom:4px;">📊 Trung bình (${h.count} mẫu)</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;font-size:12px;">
        ${h.ph ? `<span style="background:#E8F5E9;padding:2px 8px;border-radius:4px;">pH ${h.ph}</span>` : ''}
        ${h.n ? `<span style="background:#E3F2FD;padding:2px 8px;border-radius:4px;">N ${h.n}</span>` : ''}
        ${h.p ? `<span style="background:#FFF3E0;padding:2px 8px;border-radius:4px;">P ${h.p}</span>` : ''}
        ${h.k ? `<span style="background:#F3E5F5;padding:2px 8px;border-radius:4px;">K ${h.k}</span>` : ''}
        ${h.om ? `<span style="background:#EFEBE9;padding:2px 8px;border-radius:4px;">OM ${h.om}%</span>` : ''}
      </div>
      <div style="margin-top:6px;font-size:11px;color:var(--c-text-muted);">Mẫu mới nhất: ${history.latest.date} · ${history.latest.depth}cm</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;">
        ${history.samples.slice(0, 10).map(s =>
          `<span style="font-size:10px;background:#f5f5f5;padding:2px 6px;border-radius:4px;">${s.date} pH=${s.ph != null ? s.ph : '-'}</span>`
        ).join('')}
      </div>
    </div>
  `;
};

window.wire_soil = function () {};
