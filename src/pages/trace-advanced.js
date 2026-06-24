import { genealogyStore, processingStore, inspectionStore, coldChainStore } from '../stores/trace-advanced.js';
function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

export async function renderTraceAdvanced() {
  const allProc = await processingStore.getAll();
  const allInsp = await inspectionStore.getAll();

  window._genealogy = genealogyStore;

  return `
    <div class="app-header">🔍 Truy xuất nâng cao
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('more')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>

    <div style="display:flex;gap:4px;padding:8px 16px;">
      <button class="btn primary" style="flex:1;font-size:12px;" onclick="window.tadvTab('genealogy')">🌳 Phả hệ</button>
      <button class="btn secondary" style="flex:1;font-size:12px;" onclick="window.tadvTab('processing')">🏭 Chế biến</button>
      <button class="btn secondary" style="flex:1;font-size:12px;" onclick="window.tadvTab('inspection')">🔬 Kiểm định</button>
      <button class="btn secondary" style="flex:1;font-size:12px;" onclick="window.tadvTab('coldchain')">❄️ Cold chain</button>
    </div>

    <div id="tadv-genealogy-tab">
      <div class="card" style="padding:12px;margin:8px 16px;">
        <div style="font-weight:600;margin-bottom:6px;">🌳 Tra cứu phả hệ lô</div>
        <div style="display:flex;gap:4px;">
          <input id="tadv-gen-lot" class="form" placeholder="Nhập mã lô (vd: LOT001)" style="flex:1;" />
          <button class="btn primary" onclick="window.tadvSearchGenealogy()">Tra</button>
        </div>
        <div id="tadv-gen-result" style="margin-top:8px;"></div>
      </div>

      <h3 style="padding:8px 16px 2px;font-size:13px;color:var(--c-text-muted);text-transform:uppercase;">Tách / Nhập lô</h3>
      <div style="padding:0 16px;display:flex;gap:4px;">
        <button class="btn secondary" style="flex:1;font-size:12px;" onclick="window.tadvShowSplitForm()">✂️ Tách lô</button>
        <button class="btn secondary" style="flex:1;font-size:12px;" onclick="window.tadvShowMergeForm()">🔗 Nhập lô</button>
      </div>
      <div id="tadv-split-form" style="display:none;padding:12px;margin:8px 16px;border:2px solid #F57F17;border-radius:10px;">
        <div style="font-weight:700;margin-bottom:6px;">✂️ Tách lô</div>
        <input id="tadv-split-source" class="form" placeholder="Lô nguồn *" />
        <input id="tadv-split-targets" class="form" placeholder="Lô đích (phẩy, vd: LOTA,LOTB)" />
        <input id="tadv-split-qtys" class="form" placeholder="Số lượng tương ứng (phẩy)" />
        <button class="btn primary" style="width:100%;margin-top:6px;" onclick="window.tadvDoSplit()">💾 Tách</button>
        <button class="btn secondary" style="width:100%;margin-top:4px;" onclick="document.getElementById('tadv-split-form').style.display='none'">Hủy</button>
      </div>
      <div id="tadv-merge-form" style="display:none;padding:12px;margin:8px 16px;border:2px solid #1565C0;border-radius:10px;">
        <div style="font-weight:700;margin-bottom:6px;">🔗 Nhập lô</div>
        <input id="tadv-merge-target" class="form" placeholder="Lô đích *" />
        <input id="tadv-merge-sources" class="form" placeholder="Lô nguồn (phẩy, vd: LOTA,LOTB)" />
        <button class="btn primary" style="width:100%;margin-top:6px;" onclick="window.tadvDoMerge()">💾 Nhập</button>
        <button class="btn secondary" style="width:100%;margin-top:4px;" onclick="document.getElementById('tadv-merge-form').style.display='none'">Hủy</button>
      </div>
    </div>

    <div id="tadv-processing-tab" style="display:none;">
      <div style="padding:0 16px 8px;">
        <button class="btn primary" style="width:100%;font-size:13px;" onclick="window.tadvShowProcForm()">➕ Ghi nhận chế biến</button>
      </div>
      <div id="tadv-proc-form" style="display:none;padding:12px;margin:0 16px 8px;border:2px solid #6A1B9A;border-radius:10px;">
        <div style="font-weight:700;margin-bottom:6px;">🏭 Ghi nhận chế biến</div>
        <input id="tadv-proc-name" class="form" placeholder="Tên mẻ chế biến *" />
        <input id="tadv-proc-inputs" class="form" placeholder="Lô đầu vào (vd: LOT001:50,LOT002:30)" />
        <input id="tadv-proc-output" class="form" placeholder="Sản phẩm đầu ra *" />
        <div style="display:flex;gap:4px;">
          <input id="tadv-proc-qty" class="form" type="number" placeholder="SL đầu ra" style="flex:1;" />
          <input id="tadv-proc-unit" class="form" placeholder="ĐVT" style="width:60px;" value="kg" />
        </div>
        <input id="tadv-proc-cost" class="form" type="number" placeholder="Chi phí chế biến (VNĐ)" />
        <textarea id="tadv-proc-notes" class="form" placeholder="Ghi chú" rows="2"></textarea>
        <button class="btn primary" style="width:100%;margin-top:6px;" onclick="window.tadvAddProc()">💾 Lưu</button>
        <button class="btn secondary" style="width:100%;margin-top:4px;" onclick="document.getElementById('tadv-proc-form').style.display='none'">Hủy</button>
      </div>

      <h3 style="padding:8px 16px 2px;font-size:13px;color:var(--c-text-muted);text-transform:uppercase;">Lịch sử chế biến</h3>
      ${allProc.length === 0
        ? '<div class="empty" style="padding:20px;"><div class="ico">🏭</div><p>Chưa có mẻ chế biến nào.</p></div>'
        : allProc.slice(0, 30).map(p => `<div class="card" style="padding:10px;">
            <div style="font-weight:600;">🏭 ${escapeHtml(p.name)}</div>
            <div style="font-size:12px;color:var(--c-text-muted);">${p.date} · Đầu vào: ${p.inputLots.map(i => i.lotId + ' (' + i.quantity + i.unit + ')').join(', ')}</div>
            <div style="font-size:13px;margin-top:2px;">📦 → ${escapeHtml(p.outputProduct)}: <strong>${p.outputQuantity}${p.unit}</strong> ${p.cost ? '· 💰 ' + p.cost.toLocaleString('vi-VN') + 'đ' : ''}</div>
          </div>`).join('')}
    </div>

    <div id="tadv-inspection-tab" style="display:none;">
      <div style="padding:0 16px 8px;">
        <button class="btn primary" style="width:100%;font-size:13px;" onclick="window.tadvShowInspForm()">➕ Thêm kiểm định</button>
      </div>
      <div id="tadv-insp-form" style="display:none;padding:12px;margin:0 16px 8px;border:2px solid #2E7D32;border-radius:10px;">
        <div style="font-weight:700;margin-bottom:6px;">🔬 Thêm kiểm định</div>
        <input id="tadv-insp-lot" class="form" placeholder="Mã lô *" />
        <select id="tadv-insp-type" class="form">
          <option value="harvest">Thu hoạch</option>
          <option value="pre_shipment">Trước giao hàng</option>
          <option value="incoming">Nhập kho</option>
          <option value="storage">Bảo quản</option>
        </select>
        <select id="tadv-insp-result" class="form">
          <option value="pass">✅ Đạt</option>
          <option value="conditional">⚠ Đạt có điều kiện</option>
          <option value="fail">❌ Không đạt</option>
        </select>
        <div style="display:flex;gap:4px;flex-wrap:wrap;">
          <input id="tadv-insp-ph" class="form" type="number" placeholder="pH" step="0.1" style="flex:1;" />
          <input id="tadv-insp-brix" class="form" type="number" placeholder="Brix %" step="0.1" style="flex:1;" />
          <input id="tadv-insp-weight" class="form" type="number" placeholder="KL (g)" style="flex:1;" />
          <input id="tadv-insp-moist" class="form" type="number" placeholder="Ẩm %" style="flex:1;" />
        </div>
        <input id="tadv-insp-grade" class="form" placeholder="Phẩm cấp (A/B/C/XK)" />
        <input id="tadv-insp-inspector" class="form" placeholder="Người kiểm định" />
        <textarea id="tadv-insp-notes" class="form" placeholder="Ghi chú" rows="2"></textarea>
        <button class="btn primary" style="width:100%;margin-top:6px;" onclick="window.tadvAddInsp()">💾 Lưu</button>
        <button class="btn secondary" style="width:100%;margin-top:4px;" onclick="document.getElementById('tadv-insp-form').style.display='none'">Hủy</button>
      </div>

      <h3 style="padding:8px 16px 2px;font-size:13px;color:var(--c-text-muted);text-transform:uppercase;">Kiểm định gần đây</h3>
      ${allInsp.length === 0
        ? '<div class="empty" style="padding:20px;"><div class="ico">🔬</div><p>Chưa có kiểm định nào.</p></div>'
        : allInsp.slice(0, 30).map(i => {
            const resultMap = { pass: '✅ Đạt', conditional: '⚠ ĐK', fail: '❌ Không đạt' };
            const typeMap = { harvest: 'Thu hoạch', pre_shipment: 'Trước giao', incoming: 'Nhập kho', storage: 'Bảo quản' };
            return `<div class="card" style="padding:10px;">
              <div class="row">
                <span style="font-weight:600;">📌 ${escapeHtml(i.lotId)}</span>
                <span style="font-size:11px;color:var(--c-text-muted);">${i.date}</span>
              </div>
              <div style="font-size:12px;">${typeMap[i.type] || i.type} · ${resultMap[i.result] || i.result} ${i.grade ? '· ' + escapeHtml(i.grade) : ''}</div>
              <div style="font-size:11px;color:var(--c-text-muted);margin-top:2px;">
                ${i.ph != null ? 'pH ' + i.ph + ' · ' : ''}${i.brix != null ? 'Brix ' + i.brix + '% · ' : ''}${i.weight != null ? i.weight + 'g · ' : ''}${i.moisture != null ? 'Ẩm ' + i.moisture + '%' : ''}
              </div>
            </div>`;
          }).join('')}
    </div>

    <div id="tadv-coldchain-tab" style="display:none;">
      <div class="card" style="padding:12px;margin:8px 16px;">
        <div style="font-weight:600;margin-bottom:6px;">❄️ Ghi nhiệt độ lô</div>
        <div style="display:flex;gap:4px;">
          <input id="tadv-cold-lot" class="form" placeholder="Mã lô" style="flex:2;" />
          <input id="tadv-cold-temp" class="form" type="number" placeholder="°C" step="0.1" style="flex:1;" />
          <input id="tadv-cold-hum" class="form" type="number" placeholder="%RH" style="flex:1;" />
        </div>
        <input id="tadv-cold-loc" class="form" placeholder="Vị trí (vd: Kho A / Xe 01)" />
        <div style="display:flex;gap:4px;margin-top:4px;">
          <button class="btn primary" style="flex:1;font-size:12px;" onclick="window.tadvAddCold()">💾 Ghi</button>
          <button class="btn secondary" style="flex:1;font-size:12px;" onclick="window.tadvSearchCold()">📊 Xem lịch sử</button>
        </div>
        <div id="tadv-cold-result" style="margin-top:8px;"></div>
      </div>
    </div>
  `;
}

window.tadvTab = (tab) => {
  ['genealogy', 'processing', 'inspection', 'coldchain'].forEach(t => {
    const el = document.getElementById('tadv-' + t + '-tab');
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });
  document.querySelectorAll('[onclick*="tadvTab"]').forEach(b => b.className = b.className.replace(' primary', ' secondary'));
  const btn = document.querySelector(`[onclick*="tadvTab('${tab}')"]`);
  if (btn) btn.className = btn.className.replace(' secondary', ' primary');
};

window.tadvSearchGenealogy = async () => {
  const lotId = document.getElementById('tadv-gen-lot')?.value.trim();
  if (!lotId) { window.showToast?.('Nhập mã lô', 'err'); return; }
  const tree = await genealogyStore.getTree(lotId);
  const container = document.getElementById('tadv-gen-result');
  container.innerHTML = `
    <div class="card" style="padding:10px;border-color:#F57F17;">
      <div style="font-weight:600;">🌳 Phả hệ của ${escapeHtml(lotId)}</div>
      ${tree.parents.length ? '<div style="margin-top:6px;"><strong>⬆ Lô nguồn (parent):</strong><br/>' + tree.parents.map(p => `📌 ${escapeHtml(p.lotId)} (${p.date})`).join('<br/>') + '</div>' : ''}
      ${tree.children.length ? '<div style="margin-top:6px;"><strong>⬇ Lô con (child):</strong><br/>' + tree.children.map(c => `📌 ${escapeHtml(c.lotId)} (${c.date})`).join('<br/>') + '</div>' : ''}
      ${!tree.parents.length && !tree.children.length ? '<div style="margin-top:6px;color:var(--c-text-muted);">Không có phả hệ — lô độc lập.</div>' : ''}
    </div>
  `;
};

window.tadvShowSplitForm = () => { document.getElementById('tadv-split-form').style.display = 'block'; };
window.tadvShowMergeForm = () => { document.getElementById('tadv-merge-form').style.display = 'block'; };
window.tadvShowProcForm = () => { document.getElementById('tadv-proc-form').style.display = 'block'; };
window.tadvShowInspForm = () => { document.getElementById('tadv-insp-form').style.display = 'block'; };

window.tadvDoSplit = async () => {
  const source = document.getElementById('tadv-split-source')?.value.trim();
  const targets = (document.getElementById('tadv-split-targets')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
  const qtys = (document.getElementById('tadv-split-qtys')?.value || '').split(',').map(s => +s.trim());
  if (!source || !targets.length) { window.showToast?.('Nhập lô nguồn và đích', 'err'); return; }
  await genealogyStore.addSplit({ sourceLotId: source, targetLotIds: targets, quantities: qtys });
  window.showToast?.('✓ Đã tách lô', 'ok');
  document.querySelector('[x-data]').__x?.$data?.nav?.('trace-advanced');
};

window.tadvDoMerge = async () => {
  const target = document.getElementById('tadv-merge-target')?.value.trim();
  const sources = (document.getElementById('tadv-merge-sources')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!target || !sources.length) { window.showToast?.('Nhập lô đích và nguồn', 'err'); return; }
  await genealogyStore.addMerge({ targetLotId: target, sourceLotIds: sources });
  window.showToast?.('✓ Đã nhập lô', 'ok');
  document.querySelector('[x-data]').__x?.$data?.nav?.('trace-advanced');
};

window.tadvAddProc = async () => {
  const name = document.getElementById('tadv-proc-name')?.value.trim();
  const inputsRaw = (document.getElementById('tadv-proc-inputs')?.value || '').trim();
  const output = document.getElementById('tadv-proc-output')?.value.trim();
  if (!name || !inputsRaw || !output) { window.showToast?.('Điền đủ thông tin', 'err'); return; }
  const inputLots = inputsRaw.split(',').map(s => {
    const [lotId, qty] = s.trim().split(':');
    return { lotId: lotId.trim(), quantity: +qty || 0, unit: 'kg' };
  }).filter(i => i.lotId);
  await processingStore.add({
    name, inputLots, outputProduct: output,
    outputQuantity: document.getElementById('tadv-proc-qty')?.value || 0,
    unit: document.getElementById('tadv-proc-unit')?.value || 'kg',
    cost: document.getElementById('tadv-proc-cost')?.value || 0,
    notes: document.getElementById('tadv-proc-notes')?.value || ''
  });
  window.showToast?.('✓ Đã ghi nhận chế biến', 'ok');
  document.querySelector('[x-data]').__x?.$data?.nav?.('trace-advanced');
};

window.tadvAddInsp = async () => {
  const lotId = document.getElementById('tadv-insp-lot')?.value.trim();
  if (!lotId) { window.showToast?.('Nhập mã lô', 'err'); return; }
  await inspectionStore.add({
    lotId,
    type: document.getElementById('tadv-insp-type')?.value || 'harvest',
    result: document.getElementById('tadv-insp-result')?.value || 'pass',
    ph: document.getElementById('tadv-insp-ph')?.value,
    brix: document.getElementById('tadv-insp-brix')?.value,
    weight: document.getElementById('tadv-insp-weight')?.value,
    moisture: document.getElementById('tadv-insp-moist')?.value,
    grade: document.getElementById('tadv-insp-grade')?.value || '',
    inspector: document.getElementById('tadv-insp-inspector')?.value || '',
    notes: document.getElementById('tadv-insp-notes')?.value || ''
  });
  window.showToast?.('✓ Đã thêm kiểm định', 'ok');
  document.querySelector('[x-data]').__x?.$data?.nav?.('trace-advanced');
};

window.tadvAddCold = async () => {
  const lotId = document.getElementById('tadv-cold-lot')?.value.trim();
  const temp = document.getElementById('tadv-cold-temp')?.value;
  if (!lotId || temp == null) { window.showToast?.('Nhập mã lô và nhiệt độ', 'err'); return; }
  await coldChainStore.add({
    lotId,
    temp: +temp,
    humidity: document.getElementById('tadv-cold-hum')?.value || null,
    location: document.getElementById('tadv-cold-loc')?.value || '',
    notes: ''
  });
  window.showToast?.('✓ Đã ghi nhiệt độ', 'ok');
};

window.tadvSearchCold = async () => {
  const lotId = document.getElementById('tadv-cold-lot')?.value.trim();
  if (!lotId) { window.showToast?.('Nhập mã lô', 'err'); return; }
  const logs = await coldChainStore.getByLot(lotId);
  const summary = await coldChainStore.getSummary(lotId);
  const container = document.getElementById('tadv-cold-result');
  if (!logs.length) { container.innerHTML = '<div class="card-meta">Chưa có dữ liệu cold chain cho lô này.</div>'; return; }
  container.innerHTML = `
    <div class="card" style="padding:10px;border-color:#0288D1;">
      <div style="font-weight:600;">❄️ Cold chain — ${escapeHtml(lotId)}</div>
      <div style="font-size:12px;color:var(--c-text-muted);">TB: ${summary.avgTemp}°C · Thấp: ${summary.minTemp}°C · Cao: ${summary.maxTemp}°C · ${summary.count} lần ghi</div>
      <div style="margin-top:4px;max-height:150px;overflow-y:auto;">
        ${logs.slice(0, 20).map(l => `<div style="font-size:11px;padding:2px 0;border-bottom:1px solid var(--c-border);">
          ${l.date} · ${l.temp}°C ${l.humidity != null ? '· ' + l.humidity + '%RH' : ''} ${l.location ? '· ' + escapeHtml(l.location) : ''}
        </div>`).join('')}
      </div>
    </div>
  `;
};

window.wire_trace_advanced = function () {};
