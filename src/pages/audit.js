import { auditStore } from '../stores/audit.js';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

const TYPE_LABEL = {
  command: { icon: '⚡', label: 'Lệnh thiết bị' },
  schedule: { icon: '⏰', label: 'Lịch tưới' },
  auth: { icon: '🔐', label: 'Xác thực' },
  config: { icon: '⚙️', label: 'Cấu hình' }
};

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function fmtTime(ts) {
  try { return new Date(ts).toLocaleString('vi-VN'); } catch { return String(ts); }
}

export async function renderAudit() {
  const entries = await auditStore.recent(100);
  const counts = {};
  entries.forEach(e => { counts[e.type] = (counts[e.type] || 0) + 1; });

  return `
    <div class="app-header">📋 Nhật ký hoạt động
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('settings')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>

    <div style="display:flex;gap:6px;padding:10px 16px;">
      <div style="flex:1;background:#fff;border:1px solid var(--c-border);border-radius:10px;padding:8px 4px;text-align:center;">
        <div style="font-size:18px;font-weight:700;">${entries.length}</div>
        <div style="font-size:10px;color:var(--c-text-muted);">Tổng sự kiện</div>
      </div>
      ${Object.entries(TYPE_LABEL).map(([k, v]) => `
        <div style="flex:1;background:#fff;border:1px solid var(--c-border);border-radius:10px;padding:8px 4px;text-align:center;">
          <div style="font-size:16px;font-weight:700;">${counts[k] || 0}</div>
          <div style="font-size:10px;color:var(--c-text-muted);">${v.icon} ${v.label}</div>
        </div>`).join('')}
    </div>

    <div style="display:flex;gap:8px;padding:0 16px 8px;">
      <select id="audit-filter" style="flex:1;padding:8px;border:1px solid var(--c-border);border-radius:8px;font-size:13px;">
        <option value="all">Tất cả</option>
        <option value="command">⚡ Lệnh thiết bị</option>
        <option value="schedule">⏰ Lịch tưới</option>
        <option value="auth">🔐 Xác thực</option>
        <option value="config">⚙️ Cấu hình</option>
      </select>
      <button id="audit-export" class="btn secondary" style="width:auto;padding:8px 14px;font-size:13px;">⬇ Xuất</button>
      <button id="audit-clear" class="btn danger" style="width:auto;padding:8px 14px;font-size:13px;">🗑 Xoá</button>
    </div>

    <div id="audit-list">
      ${entries.length === 0
        ? `<div class="empty"><div class="ico">📋</div><p>Chưa có hoạt động nào.</p></div>`
        : entries.map(entryCard).join('')}
    </div>
  `;
}

function entryCard(e) {
  const meta = TYPE_LABEL[e.type] || { icon: '📝', label: e.type || 'Khác' };
  const statusColor = e.status === 'ok' || e.status === 'success' ? '#2E7D32'
    : e.status === 'error' || e.status === 'fail' ? '#c62828'
    : '#F9A825';
  return `
    <div class="card" style="padding:10px;">
      <div class="row">
        <div style="display:flex;gap:8px;align-items:center;">
          <span style="font-size:18px;">${meta.icon}</span>
          <div>
            <div style="font-weight:600;font-size:14px;">${esc(e.detail || meta.label)}</div>
            <div style="font-size:12px;color:var(--c-text-muted);">${meta.label} · ${esc(e.actor || '-')} · ${fmtTime(e.ts)}</div>
          </div>
        </div>
        <span class="pill" style="background:${statusColor}22;color:${statusColor};border:1px solid ${statusColor}44;">${esc(e.status || '-')}</span>
      </div>
      ${e.deviceId ? `<div style="margin-top:4px;font-size:12px;color:var(--c-text-muted);">Thiết bị: <strong>${esc(e.deviceId)}</strong> · Hành động: ${esc(e.action || '-')}</div>` : ''}
    </div>
  `;
}

function isNative() { try { return Capacitor.isNativePlatform && Capacitor.isNativePlatform(); } catch { return false; } }

async function exportAuditJson() {
  const all = await auditStore.all();
  const json = JSON.stringify(all, null, 2);
  const filename = `farmos-audit-${new Date().toISOString().slice(0, 10)}.json`;
  if (!isNative()) {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
    return;
  }
  await Filesystem.writeFile({ path: filename, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
  const { uri } = await Filesystem.getUri({ directory: Directory.Cache, path: filename });
  try { await Share.share({ title: filename, files: [uri] }); } catch (_) {}
}

window.wire_audit = function () {
  const toast = (m, t) => window.showToast && window.showToast(m, t || '');
  const filter = document.getElementById('audit-filter');
  const list = document.getElementById('audit-list');

  if (filter && list) {
    filter.addEventListener('change', async () => {
      const val = filter.value;
      const all = val === 'all' ? await auditStore.recent(100) : await auditStore.byType(val);
      list.innerHTML = all.length === 0
        ? `<div class="empty"><div class="ico">📋</div><p>Không có hoạt động nào.</p></div>`
        : all.map(entryCard).join('');
    });
  }

  document.getElementById('audit-export')?.addEventListener('click', async () => {
    try {
      await exportAuditJson();
      toast('✓ Đã xuất nhật ký', 'ok');
    } catch (e) { toast('✗ ' + e.message, 'err'); }
  });

  document.getElementById('audit-clear')?.addEventListener('click', async () => {
    if (!confirm('Xoá toàn bộ nhật ký hoạt động?')) return;
    await auditStore.clear();
    toast('✓ Đã xoá nhật ký', 'ok');
    document.querySelector('[x-data]').__x.$data.nav('audit');
  });
};
