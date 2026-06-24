import { recallStore } from '../stores/trace-advanced.js';

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

const SEVERITY_MAP = {
  critical: { label: 'Nghiêm trọng', color: '#c62828', bg: '#FFEBEE' },
  high: { label: 'Cao', color: '#E65100', bg: '#FFF3E0' },
  medium: { label: 'Trung bình', color: '#F57F17', bg: '#FFF8E1' },
  low: { label: 'Thấp', color: '#999', bg: '#f5f5f5' }
};

const STATUS_MAP = {
  open: { label: 'Chờ xử lý', color: '#c62828', bg: '#FFEBEE' },
  in_progress: { label: 'Đang xử lý', color: '#E65100', bg: '#FFF3E0' },
  resolved: { label: 'Đã giải quyết', color: '#2E7D32', bg: '#E8F5E9' },
  closed: { label: 'Đã đóng', color: '#999', bg: '#f5f5f5' }
};

export async function renderRecall() {
  const all = await recallStore.getAll();
  const summary = await recallStore.getSummary();

  return `
    <div class="app-header">🚨 Thu hồi sản phẩm
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('more')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>

    ${summary.urgent > 0 ? `<div style="background:#c62828;color:#fff;padding:10px 16px;text-align:center;font-weight:700;font-size:14px;animation:pulse 1.5s infinite;">
      🚨 ${summary.urgent} vụ thu hồi khẩn cấp cần xử lý ngay!
    </div>` : ''}

    <div style="display:flex;gap:6px;padding:10px 16px;flex-wrap:wrap;">
      <div class="card" style="flex:1;padding:8px;text-align:center;border-color:#c62828;">
        <div style="font-size:22px;font-weight:800;color:#c62828;">${summary.open}</div>
        <div style="font-size:10px;color:var(--c-text-muted);">Chờ xử lý</div>
      </div>
      <div class="card" style="flex:1;padding:8px;text-align:center;border-color:#E65100;">
        <div style="font-size:22px;font-weight:800;color:#E65100;">${summary.inProgress}</div>
        <div style="font-size:10px;color:var(--c-text-muted);">Đang xử lý</div>
      </div>
      <div class="card" style="flex:1;padding:8px;text-align:center;">
        <div style="font-size:22px;font-weight:800;color:#2E7D32;">${summary.resolved}</div>
        <div style="font-size:10px;color:var(--c-text-muted);">Đã xong</div>
      </div>
      <div class="card" style="flex:1;padding:8px;text-align:center;">
        <div style="font-size:22px;font-weight:800;">${summary.total}</div>
        <div style="font-size:10px;color:var(--c-text-muted);">Tổng</div>
      </div>
    </div>

    <div style="padding:0 16px 8px;">
      <button class="btn primary" style="width:100%;font-size:13px;${summary.urgent ? 'background:#c62828;' : ''}" onclick="window.recallShowForm()">➕ Tạo vụ thu hồi</button>
    </div>

    <div id="recall-add-form" style="display:none;padding:12px;margin:0 16px 8px;border:2px solid #c62828;border-radius:10px;">
      <div style="font-weight:700;margin-bottom:8px;">🚨 Tạo vụ thu hồi</div>
      <input id="recall-lot" class="form" placeholder="Mã lô / sản phẩm *" />
      <textarea id="recall-reason" class="form" placeholder="Lý do thu hồi *" rows="2"></textarea>
      <select id="recall-severity" class="form">
        <option value="critical">🔴 Nghiêm trọng</option>
        <option value="high">🟠 Cao</option>
        <option value="medium">🟡 Trung bình</option>
        <option value="low">⚪ Thấp</option>
      </select>
      <div style="display:flex;gap:4px;">
        <input id="recall-qty" class="form" type="number" placeholder="SL ảnh hưởng" style="flex:1;" />
        <input id="recall-unit" class="form" placeholder="ĐVT" style="width:60px;" value="kg" />
      </div>
      <select id="recall-scope" class="form">
        <option value="internal">Nội bộ</option>
        <option value="customer">Khách hàng</option>
        <option value="public">Công khai</option>
      </select>
      <select id="recall-action" class="form">
        <option value="destroy">Tiêu hủy</option>
        <option value="rework">Gia công lại</option>
        <option value="return">Thu hồi / Hoàn tiền</option>
        <option value="discount">Bán giảm giá</option>
      </select>
      <textarea id="recall-notes" class="form" placeholder="Ghi chú" rows="2"></textarea>
      <button class="btn primary" style="width:100%;margin-top:6px;background:#c62828;" onclick="window.recallAdd()">🚨 Tạo vụ thu hồi</button>
      <button class="btn secondary" style="width:100%;margin-top:4px;" onclick="document.getElementById('recall-add-form').style.display='none'">Hủy</button>
    </div>

    <h3 style="padding:8px 16px 2px;font-size:13px;color:var(--c-text-muted);text-transform:uppercase;">Danh sách thu hồi</h3>
    ${all.length === 0
      ? '<div class="empty" style="padding:20px;"><div class="ico">🚨</div><p>Chưa có vụ thu hồi nào.</p></div>'
      : all.map(r => {
          const sev = SEVERITY_MAP[r.severity] || SEVERITY_MAP.medium;
          const st = STATUS_MAP[r.status] || STATUS_MAP.open;
          return `<div class="card" style="padding:10px;border-left:4px solid ${sev.color};">
            <div class="row">
              <div>
                <span style="font-weight:600;">📌 ${esc(r.lotId)}</span>
                <span style="background:${st.bg};color:${st.color};padding:2px 6px;border-radius:4px;font-size:10px;margin-left:6px;">${st.label}</span>
                <span style="background:${sev.bg};color:${sev.color};padding:2px 6px;border-radius:4px;font-size:10px;margin-left:4px;">${sev.label}</span>
              </div>
              <span style="font-size:11px;color:var(--c-text-muted);">${r.date}</span>
            </div>
            <div style="font-size:12px;margin-top:4px;">${esc(r.reason)}</div>
            <div style="font-size:12px;color:var(--c-text-muted);margin-top:2px;">
              📦 ${r.affectedQuantity}${r.unit} · Phạm vi: ${r.scope === 'public' ? '🌐 Công khai' : r.scope === 'customer' ? '🤝 Khách hàng' : '🏢 Nội bộ'}
              · Hành động: ${r.action === 'destroy' ? '🗑 Tiêu hủy' : r.action === 'rework' ? '🔧 Gia công' : r.action === 'return' ? '💰 Hoàn tiền' : '🏷 Giảm giá'}
            </div>
            <div style="display:flex;gap:4px;margin-top:6px;">
              ${r.status !== 'resolved' && r.status !== 'closed' ? `
                <button class="btn small" onclick="window.recallUpdate('${r.id}','in_progress')" style="font-size:10px;">🔧 Xử lý</button>
                <button class="btn small" onclick="window.recallUpdate('${r.id}','resolved')" style="font-size:10px;">✅ Giải quyết</button>
              ` : ''}
              <button class="btn small" onclick="window.recallTrace('${r.lotId}')" style="font-size:10px;">🔍 Truy xuất</button>
            </div>
            ${r.notes ? `<div style="font-size:11px;color:var(--c-text-muted);margin-top:2px;">📝 ${esc(r.notes)}</div>` : ''}
            <div id="recall-trace-${r.lotId}" style="margin-top:4px;"></div>
          </div>`;
        }).join('')}
  `;
}

window.recallShowForm = () => { document.getElementById('recall-add-form').style.display = 'block'; };

window.recallAdd = async () => {
  const lotId = document.getElementById('recall-lot')?.value.trim();
  const reason = document.getElementById('recall-reason')?.value.trim();
  if (!lotId || !reason) { window.showToast?.('Nhập mã lô và lý do', 'err'); return; }
  await recallStore.add({
    lotId, reason,
    severity: document.getElementById('recall-severity')?.value || 'medium',
    affectedQuantity: document.getElementById('recall-qty')?.value || 0,
    unit: document.getElementById('recall-unit')?.value || 'kg',
    scope: document.getElementById('recall-scope')?.value || 'internal',
    action: document.getElementById('recall-action')?.value || 'destroy',
    notes: document.getElementById('recall-notes')?.value || ''
  });
  window.showToast?.('✓ Đã tạo vụ thu hồi', 'ok');
  document.querySelector('[x-data]').__x?.$data?.nav?.('recall');
};

window.recallUpdate = async (id, status) => {
  await recallStore.update(id, { status });
  window.showToast?.('✓ Đã cập nhật', 'ok');
  document.querySelector('[x-data]').__x?.$data?.nav?.('recall');
};

window.recallTrace = async (lotId) => {
  const forward = await recallStore.traceForward(lotId);
  const backward = await recallStore.traceBackward(lotId);
  const container = document.getElementById('recall-trace-' + lotId);
  if (!container) return;
  container.innerHTML = `
    <div class="card" style="padding:8px;margin-top:4px;border-color:#c62828;font-size:12px;">
      <div style="font-weight:600;">🔍 Truy xuất ${esc(lotId)}</div>
      ${backward.length ? '<div><strong>⬆ Nguồn gốc:</strong> ' + backward.map(b => esc(b.lotId)).join(' → ') + '</div>' : ''}
      ${forward.length ? '<div><strong>⬇ Phân phối:</strong> ' + forward.map(f => esc(f.lotId)).join(' → ') + '</div>' : ''}
      ${!forward.length && !backward.length ? '<div style="color:var(--c-text-muted);">Không tìm thấy chuỗi liên quan.</div>' : ''}
    </div>
  `;
};

window.wire_recall = function () {};
