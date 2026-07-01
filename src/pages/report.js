// Feature M — Báo cáo PDF tuần/tháng (jsPDF, generate from local cache)
import { jsPDF } from 'jspdf';
import { get } from 'idb-keyval';
import { authStore } from '../stores/auth.js';

export async function renderReport() {
  return `
    <div class="app-header">📄 Báo cáo PDF
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('dashboard')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>
    <div class="form">
      <label>Loại báo cáo</label>
      <select id="report-type">
        <option value="weekly">Tuần (7 ngày)</option>
        <option value="monthly">Tháng (30 ngày)</option>
      </select>
      <button id="gen-report" class="btn" style="margin-top:18px;">📄 Tạo PDF</button>
      <p style="font-size:12px; color:var(--c-text-muted); margin-top:10px; text-align:center;">
        Báo cáo dùng dữ liệu cache trên thiết bị, không cần mạng.
      </p>
    </div>
  `;
}

window.wire_report = function() {
  document.getElementById('gen-report')?.addEventListener('click', async () => {
    const type = document.getElementById('report-type').value;
    const days = type === 'weekly' ? 7 : 30;
    const cutoff = Date.now() - days * 24 * 3600 * 1000;
    const logs = ((await get('cache:log:recent')) || []).filter(l => l.ts >= cutoff);
    const sensors = (await get('cache:sensors:latest')) || {};

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.setFont('helvetica');

    // Header
    doc.setFontSize(18);
    doc.setTextColor(46, 125, 50);
    doc.text('EcoSynTech Farm OS', 14, 18);
    doc.setFontSize(13);
    doc.setTextColor(0);
    doc.text(`Bao cao ${type === 'weekly' ? 'tuan' : 'thang'} - ${new Date().toLocaleDateString('vi-VN')}`, 14, 26);

    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Farmer: ${authStore.farmerId || '-'}  ·  ${days} ngay gan day`, 14, 32);

    // Summary
    let y = 44;
    doc.setFontSize(12); doc.setTextColor(0);
    doc.text('1. Tom tat hoat dong', 14, y); y += 6;
    doc.setFontSize(10);
    const byActivity = {};
    logs.forEach(l => { byActivity[l.activity] = (byActivity[l.activity] || 0) + 1; });
    Object.entries(byActivity).forEach(([k, v]) => {
      doc.text(`- ${k}: ${v} lan`, 16, y); y += 5;
    });
    if (logs.length === 0) { doc.text('(Khong co du lieu trong ky)', 16, y); y += 5; }

    y += 6;
    doc.setFontSize(12);
    doc.text('2. Sensor snapshot gan nhat', 14, y); y += 6;
    doc.setFontSize(10);
    const zones = (sensors.data && (sensors.data.zones || sensors.data)) || [];
    (Array.isArray(zones) ? zones : []).slice(0, 8).forEach(z => {
      const line = `- ${z.zoneId || z.id || '-'}: T ${z.temp || '-'}C, H ${z.humidity || z.hum || '-'}%, pH ${z.ph || '-'}`;
      doc.text(line, 16, y); y += 5;
    });

    y += 6;
    doc.setFontSize(12);
    doc.text('3. Chi tiet nhat ky', 14, y); y += 6;
    doc.setFontSize(9);
    logs.slice(0, 30).forEach(l => {
      if (y > 280) { doc.addPage(); y = 20; }
      const time = new Date(l.ts).toLocaleString('vi-VN');
      doc.text(`${time} | ${l.activity} | Z=${l.zoneId} | ${l.synced ? 'OK' : 'PENDING'}`, 16, y); y += 4;
      if (l.note) { doc.text(`   ${(l.note || '').slice(0, 80)}`, 16, y); y += 4; }
    });

    // Footer
    doc.setFontSize(8); doc.setTextColor(150);
    doc.text(`Generated ${new Date().toISOString()}  ·  EcoSynTech Farm OS v7.0.2`, 14, 290);

    doc.save(`ecosyntech-report-${type}-${new Date().toISOString().slice(0,10)}.pdf`);
    window.showToast && window.showToast('✓ Đã tải PDF', 'ok');
  });
};
