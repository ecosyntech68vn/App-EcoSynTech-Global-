// Feature O — SOP inline help (bundled markdown, offline)

const SOPs = {
  irrigation: `## SOP — Tưới nước
1. Kiểm tra độ ẩm đất (target 60-75% cho rau ăn lá, 50-65% cho cà chua).
2. Mở van tưới gốc / nhỏ giọt. Tránh tưới lá vào trưa nắng.
3. Thời gian tưới: 15-30 phút tuỳ kích thước zone.
4. Sau khi tưới: ghi log "Tưới nước" + zone + thời lượng.
5. Cảnh báo: nếu độ ẩm vẫn <40% sau 30p tưới → kiểm tra rò rỉ.`,

  fertilizer: `## SOP — Bón phân
1. Kiểm tra EC sensor hiện tại (target 1.5-2.5 mS/cm).
2. Trộn dung dịch theo công thức:
   - NPK 16-16-8: 2g/L
   - Hữu cơ pha loãng: 5ml/L
3. Tưới gốc, không phun lá (trừ phân bón lá chuyên dụng).
4. Sau bón 4h kiểm tra EC lại, target không tăng quá +0.5.
5. Ghi log "Bón phân" + zone + loại phân + lượng.`,

  pest: `## SOP — Xử lý sâu bệnh
1. Quan sát triệu chứng: lá vàng, đốm nâu, sâu hiện diện?
2. Chụp ảnh + ghi log "Xử lý sâu/bệnh" + zone + mô tả + mức độ.
3. Cách xử lý ưu tiên: sinh học → vật lý → hoá học (cuối cùng).
4. Nếu dùng thuốc: ghi rõ tên + nồng độ + thời gian cách ly trước thu hoạch.
5. Theo dõi 3 ngày, nếu không đỡ → escalate tech.`,

  harvest: `## SOP — Thu hoạch
1. Kiểm tra tiêu chí: kích thước, màu sắc, độ chín.
2. Thu hoạch sáng sớm khi nhiệt độ <28°C.
3. Cắt cuống bằng kéo sạch, không kéo gãy.
4. Phân loại tại chỗ: A (tốt), B (trung bình), C (loại).
5. Ghi log "Thu hoạch" + zone + sản lượng kg + chất lượng.
6. Gửi sản phẩm đến khu sơ chế trong 2h.`,

  general: `## SOP — Vận hành hàng ngày
1. **Sáng 6h**: Kiểm tra Dashboard cảnh báo qua đêm.
2. **Sáng 7-9h**: Tưới + bón theo schedule.
3. **Trưa**: Tránh thao tác ngoài đồng (UV cao).
4. **Chiều 15-17h**: Kiểm tra zone, thu hoạch.
5. **Tối**: Review Task hoàn thành, đồng bộ data.`
};

export async function renderSOP() {
  return `
    <div class="app-header">📖 SOP — Quy trình
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('dashboard')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>
    <div class="form">
      <label>Chọn quy trình</label>
      <select id="sop-pick">
        <option value="general">Vận hành chung</option>
        <option value="irrigation">Tưới nước</option>
        <option value="fertilizer">Bón phân</option>
        <option value="pest">Xử lý sâu bệnh</option>
        <option value="harvest">Thu hoạch</option>
      </select>
    </div>
    <div class="card" id="sop-content" style="white-space:pre-wrap; font-family:Georgia, serif;">${escapeHtml(SOPs.general)}</div>
  `;
}

window.wire_sop = function() {
  document.getElementById('sop-pick')?.addEventListener('change', (e) => {
    document.getElementById('sop-content').textContent = SOPs[e.target.value] || '(Không có)';
  });
};
function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
