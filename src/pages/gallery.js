// Feature N — Photo growth timeline (gallery from log photos)
import { get } from 'idb-keyval';

export async function renderGallery() {
  const logs = (await get('cache:log:recent')) || [];
  const withPhoto = logs.filter(l => l.photoPath);
  // Group by date
  const byDate = {};
  for (const l of withPhoto) {
    const d = new Date(l.ts).toLocaleDateString('vi-VN');
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(l);
  }

  return `
    <div class="app-header">🖼 Album hoạt động
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('dashboard')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>
    ${withPhoto.length === 0
      ? `<div class="empty"><div class="ico">🖼</div><p>Chưa có ảnh nào. Chụp ảnh khi ghi nhật ký.</p></div>`
      : Object.entries(byDate).map(([date, items]) => `
          <h3 style="padding:10px 16px 0; color:var(--c-text-muted); font-size:13px; text-transform:uppercase;">${escapeHtml(date)}</h3>
          <div style="padding:0 16px; display:grid; grid-template-columns:repeat(3, 1fr); gap:6px;">
            ${items.map(it => `
              <div style="position:relative; aspect-ratio:1; border-radius:8px; overflow:hidden; background:#eee;">
                <img src="${escapeHtml(it.photoPath)}" style="width:100%; height:100%; object-fit:cover;" loading="lazy" />
                <div style="position:absolute; bottom:0; left:0; right:0; background:linear-gradient(to top, rgba(0,0,0,.7), transparent); color:white; padding:6px; font-size:10px;">
                  ${escapeHtml(it.activity)} · ${escapeHtml(it.zoneId)}
                </div>
              </div>
            `).join('')}
          </div>
        `).join('')}
  `;
}

function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
window.wire_gallery = function() {};
