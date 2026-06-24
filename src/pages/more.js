// More menu — hub for V1.1, V1.2, V1.3 features + Zalo share + Geofence toggle
import { Geolocation } from '@capacitor/geolocation';
import { authStore } from '../stores/auth.js';

export async function renderMore() {
  return `
    <div class="app-header">☰ More
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('dashboard')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>

    <h3 style="padding:14px 16px 4px; color:var(--c-text-muted); font-size:13px; text-transform:uppercase;">V3.1 — Truy xuất nguồn gốc</h3>
    ${menuItem('lots', '🌾', 'Lô / Mùa vụ + QR', 'Truy xuất nguồn gốc · PHI lock')}
    ${menuItem('materials', '📦', 'Vật tư + PHI', 'Phân bón · Thuốc BVTV · tồn kho')}
    ${menuItem('inventory', '🏬', 'Kho — Nhập · Xuất · Tồn', 'Chứng từ · tồn an toàn · CSV · thu hoạch→tồn')}

    <h3 style="padding:14px 16px 4px; color:var(--c-text-muted); font-size:13px; text-transform:uppercase;">V1.1 — Core+</h3>
    ${menuItem('control', '⚡', 'Điều khiển thiết bị', '2-step confirm')}
    ${menuItem('schedule', '⏰', 'Lịch tưới / bón', 'Auto schedule')}
    ${menuItem('rules', '💧', 'Tưới thông minh', '4 chế độ · ETo/Kc theo cây · khung giờ tránh trưa')}
    ${menuItem('chart', '📈', 'Biểu đồ lịch sử', '24h/7d/30d')}

    <h3 style="padding:14px 16px 4px; color:var(--c-text-muted); font-size:13px; text-transform:uppercase;">V1.2 — Smart</h3>
    ${menuItem('scan', '📷', 'QR scan thiết bị', 'Camera scan')}
    ${menuItem('weather', '🌤', 'Thời tiết', 'OpenWeather')}
    ${menuItem('update', '📥', 'Cập nhật app', 'OTA GitHub Releases')}

    <h3 style="padding:14px 16px 4px; color:var(--c-text-muted); font-size:13px; text-transform:uppercase;">V1.3 — Pro</h3>
    ${menuItem('farms', '🏡', 'Chuyển nông trại', 'Multi-farm')}
    ${menuItem('report', '📄', 'Báo cáo PDF', 'Tuần / tháng')}
    ${menuItem('gallery', '🖼', 'Album hoạt động', 'Photo timeline')}
    ${menuItem('sop', '📖', 'SOP — Quy trình', 'Quick reference')}
    ${menuItem('pest', '🐛', 'Báo sâu bệnh', 'Severity 1-5')}

    <h3 style="padding:14px 16px 4px; color:var(--c-text-muted); font-size:13px; text-transform:uppercase;">V5.5 — Quản lý nông trại</h3>
    ${menuItem('finance', '💰', 'Tài chính', 'Chi phí · Doanh thu · Lợi nhuận theo lô')}
    ${menuItem('labor', '👷', 'Nhân công', 'Danh sách · Chấm công · Bảng lương')}
    ${menuItem('equipment', '🔧', 'Thiết bị', 'Máy móc · Bảo trì · Nhiên liệu')}
    ${menuItem('contract', '🤝', 'Hợp đồng / HTX', 'Bao tiêu · Liên kết · Giao hàng')}
    ${menuItem('soil', '🌱', 'Thổ nhưỡng', 'pH · NPK · Chất hữu cơ theo zone')}

    <h3 style="padding:14px 16px 4px; color:var(--c-text-muted); font-size:13px; text-transform:uppercase;">V6.2 — Bán hàng & Thanh toán</h3>
    ${menuItem('orders', '🛒', 'Bán hàng / Đơn hàng', 'Tạo đơn · VietQR · Hoá đơn PDF · Khách hàng')}

    <h3 style="padding:14px 16px 4px; color:var(--c-text-muted); font-size:13px; text-transform:uppercase;">V6.0 — Blockchain & Logistics</h3>
    ${menuItem('blockchain', '⛓', 'Blockchain Trace (Aptos)', 'GS1 Digital Link · On-chain proof · SHA-256 hash')}
    ${menuItem('logistics', '🚚', 'Vận chuyển', 'VNPost · ViettelPost · Tracking · COD')}

    <h3 style="padding:14px 16px 4px; color:var(--c-text-muted); font-size:13px; text-transform:uppercase;">V5.6 — Liên kết & Báo cáo tổng hợp</h3>
    ${menuItem('consolidated', '📊', 'Báo cáo tổng hợp', 'Tổng tài sản · P&L · Tồn kho · KPI tích hợp')}
    ${menuItem('trace-advanced', '🔍', 'Truy xuất nâng cao', 'Phả hệ lô · Chế biến · Kiểm định · Cold chain')}
    ${menuItem('recall', '🚨', 'Thu hồi sản phẩm', 'Truy xuất forward/backward · Xử lý vi phạm')}

    <h3 style="padding:14px 16px 4px; color:var(--c-text-muted); font-size:13px; text-transform:uppercase;">V6.3 — Nâng cao</h3>
    ${menuItem('forecast', '📈', 'Dự báo & Phân tích', 'Doanh thu · Sản lượng · AI dự đoán')}
    ${menuItem('ai-diagnosis', '🤖', 'AI Chẩn đoán sâu bệnh', 'TensorFlow Lite · Ảnh → Chẩn đoán · Đề xuất xử lý')}

    <h3 style="padding:14px 16px 4px; color:var(--c-text-muted); font-size:13px; text-transform:uppercase;">V6.3 — IoT & Server</h3>
    <div class="card" style="cursor:pointer;" onclick="document.querySelector('[x-data]').__x.$data.nav('settings')">
      <div class="row">
        <div style="display:flex; gap:12px; align-items:center;">
          <span style="font-size:28px;">🌐</span>
          <div>
            <div class="card-title">Kết nối IoT</div>
            <div class="card-meta">MQTT · Modbus · Cảm biến thật (đã sẵn sàng)</div>
          </div>
        </div>
        <span style="color:var(--c-text-muted); font-size:24px;">›</span>
      </div>
    </div>
    <div class="card" style="cursor:pointer;" onclick="document.querySelector('[x-data]').__x.$data.nav('settings')">
      <div class="row">
        <div style="display:flex; gap:12px; align-items:center;">
          <span style="font-size:28px;">☁️</span>
          <div>
            <div class="card-title">Đồng bộ Server</div>
            <div class="card-meta">Node.js · PocketBase · API REST (scaffold sẵn)</div>
          </div>
        </div>
        <span style="color:var(--c-text-muted); font-size:24px;">›</span>
      </div>
    </div>

    <h3 style="padding:14px 16px 4px; color:var(--c-text-muted); font-size:13px; text-transform:uppercase;">V5.3 — Tổng quan & Kiểm tra</h3>
    ${menuItem('overview', '📊', 'Tổng quan nông trại', 'Cảm biến · Cảnh báo · KPI')}
    ${menuItem('audit', '📋', 'Nhật ký hoạt động', 'Lịch sử lệnh · Cấu hình · Xác thực')}

    <h3 style="padding:14px 16px 4px; color:var(--c-text-muted); font-size:13px; text-transform:uppercase;">📲 Zalo Mini App</h3>
    <div class="card" onclick="window.open('https://zalo.me/s/ecosyntech','_system')" style="cursor:pointer;">
      <div class="row">
        <div style="display:flex; gap:12px; align-items:center;">
          <span style="font-size:28px;">💬</span>
          <div>
            <div class="card-title">Zalo Mini App</div>
            <div class="card-meta">Mở trên Zalo · Đặt hàng · Theo dõi đơn · CSKH</div>
          </div>
        </div>
        <span style="color:var(--c-text-muted); font-size:24px;">›</span>
      </div>
    </div>

    <h3 style="padding:14px 16px 4px; color:var(--c-text-muted); font-size:13px; text-transform:uppercase;">Tiện ích</h3>
    <div class="card">
      <button id="zalo-share" class="btn secondary" style="width:100%;">📲 Chia sẻ alert qua Zalo</button>
    </div>
    <div class="card">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
        <input id="geo-toggle" type="checkbox" />
        <span><strong>📍 Geofence auto check-in</strong><br/><small style="color:var(--c-text-muted);">Tự ghi nhận khi đi vào zone</small></span>
      </label>
    </div>

    <div style="text-align:center; padding:20px; color:var(--c-text-muted); font-size:12px;">
      EcoSynTech Farm OS v6.3.0 · AI · IoT · Server · Dark mode · i18n · Role · Bán hàng · Blockchain
    </div>
  `;
}

function menuItem(page, icon, title, sub) {
  return `
    <div class="card" onclick="document.querySelector('[x-data]').__x.$data.nav('${page}')" style="cursor:pointer;">
      <div class="row">
        <div style="display:flex; gap:12px; align-items:center;">
          <span style="font-size:28px;">${icon}</span>
          <div>
            <div class="card-title">${title}</div>
            <div class="card-meta">${sub}</div>
          </div>
        </div>
        <span style="color:var(--c-text-muted); font-size:24px;">›</span>
      </div>
    </div>
  `;
}

let geoWatchId = null;
window.wire_more = function() {
  document.getElementById('zalo-share')?.addEventListener('click', () => {
    const msg = encodeURIComponent(`[EcoSynTech Farm OS] Cảnh báo từ nông trại ${authStore.activeFarmId || '-'} — chi tiết trong app.`);
    window.open(`zalo://send?text=${msg}`, '_system');
  });

  const geoToggle = document.getElementById('geo-toggle');
  if (geoToggle) {
    geoToggle.checked = !!geoWatchId;
    geoToggle.addEventListener('change', async () => {
      if (geoToggle.checked) {
        try {
          const perm = await Geolocation.requestPermissions();
          if (perm.location !== 'granted') { geoToggle.checked = false; return; }
          geoWatchId = await Geolocation.watchPosition({ enableHighAccuracy: false, distanceFilter: 50 }, (pos) => {
            if (pos && pos.coords) {
              // Save last position to inform check-in
              window.lastGeo = { lat: pos.coords.latitude, lng: pos.coords.longitude, ts: Date.now() };
            }
          });
          window.showToast && window.showToast('✓ Geofence ON', 'ok');
        } catch (e) {
          geoToggle.checked = false;
          window.showToast && window.showToast('Không bật được: ' + e.message, 'err');
        }
      } else {
        if (geoWatchId) { try { await Geolocation.clearWatch({ id: geoWatchId }); } catch(_){} geoWatchId = null; }
        window.showToast && window.showToast('Geofence OFF', '');
      }
    });
  }
};
