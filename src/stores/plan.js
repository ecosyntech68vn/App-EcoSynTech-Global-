// plan.js — V4.0 Feature gating theo gói dịch vụ
// NGUỒN SỰ THẬT: D:\MOHINH_AI_FIRST_ECOSYNTECHGLOBAL\PRICING_PACKAGES_V1.md
// Nguyên tắc: WLC enforce server-side qua JWT {plan, features[]}; app gate CHỈ là UX + kênh upsell.
import { authStore } from './auth.js';

// V1.4: ai_monitor (tự giám sát & phục hồi) + share_garden = MỌI GÓI;
// AI tách 3 mảng: giám sát (all) / điều phối (HTX+) / kinh doanh (Enterprise)
const BASE_FEATURES = ['monitor', 'charts', 'offline_sync', 'mobile_view', 'alerts_basic', 'weather', 'journal', 'gallery', 'sop', 'update', 'scan', 'ota_lifetime', 'ai_monitor', 'share_garden', 'storm_mode', 'cloud_dashboard'];
const PRO_FEATURES = [...BASE_FEATURES, 'control', 'schedule', 'rules', 'alerts_adv', 'reports', 'trace_basic', 'pest', 'ai_pest', 'ai_advisor', 'alert_telegram', 'alert_zalo', 'storm_alert', 'wlc_dashboard'];
const PROMAX_FEATURES = [...PRO_FEATURES, 'trace_full', 'multi_farm', 'multi_user', 'rbac', 'reports_agg', 'ai_reports', 'ai_orchestration', 'compare_zones'];
const PREMIUM_FEATURES = [...PROMAX_FEATURES, 'blockchain', 'ai_agent', 'api_access', 'priority_support', 'white_label'];

export const PLANS = {
  base: {
    label: '🏡 Home', name: 'Home', priceOnce: '3.999.000đ', sub: null,
    features: BASE_FEATURES
  },
  pro: {
    label: '🚜 Farmer', name: 'Farmer', priceOnce: '4.999.000đ', sub: '99.000đ/tháng',
    features: PRO_FEATURES
  },
  promax: {
    label: '🏢 HTX', name: 'HTX', priceOnce: '7.999.000đ', sub: '299.000đ/tháng',
    features: PROMAX_FEATURES
  },
  premium: {
    label: '🌎 Enterprise', name: 'Enterprise', priceOnce: 'Từ 14.999.000đ', sub: 'Từ 599.000đ/tháng',
    features: PREMIUM_FEATURES
  }
};

export const TRACE_BASIC_MAX_LOTS = 3;

// Tên hiển thị + gói tối thiểu cho từng feature bị khoá (dùng cho màn upsell)
export const FEATURE_INFO = {
  control: { label: 'Điều khiển thiết bị từ App', icon: '⚡', minPlan: 'pro' },
  schedule: { label: 'Tưới tự động theo lịch', icon: '⏰', minPlan: 'pro' },
  rules: { label: 'Tưới thông minh theo mùa', icon: '💧', minPlan: 'pro' },
  reports: { label: 'Báo cáo vận hành PDF', icon: '📄', minPlan: 'pro' },
  pest: { label: 'Báo sâu bệnh nâng cao', icon: '🐛', minPlan: 'pro' },
  trace_basic: { label: 'Truy xuất nguồn gốc + tem QR', icon: '🌾', minPlan: 'pro' },
  trace_full: { label: 'Truy xuất không giới hạn lô', icon: '🌾', minPlan: 'promax' },
  multi_farm: { label: 'Quản lý nhiều khu vực', icon: '🏡', minPlan: 'promax' },
  ai_orchestration: { label: 'AI điều phối vận hành nhiều khu', icon: '🧭', minPlan: 'promax' },
  compare_zones: { label: 'Bảng so sánh giữa khu/hộ', icon: '📊', minPlan: 'promax' },
  blockchain: { label: 'Truy xuất Blockchain', icon: '🔗', minPlan: 'premium' },
  white_label: { label: 'Trang truy xuất thương hiệu riêng', icon: '🎨', minPlan: 'premium' },
  ai_agent: { label: 'AI kinh doanh đầy đủ', icon: '🤖', minPlan: 'premium' }
};

export function currentPlan() {
  const p = authStore.plan;
  return PLANS[p] ? p : 'pro'; // mặc định Farmer (gói chủ lực)
}

export function hasFeature(f) {
  // Nếu WLC phát JWT kèm features[] → ưu tiên server
  if (Array.isArray(authStore.features) && authStore.features.length) {
    return authStore.features.includes(f);
  }
  return PLANS[currentPlan()].features.includes(f);
}

// Màn khoá tính năng = kênh upsell. Hiện đúng giá từ PRICING V1.1.
export function renderLockedPage(featureKey) {
  const info = FEATURE_INFO[featureKey] || { label: 'Tính năng nâng cao', icon: '🔒', minPlan: 'pro' };
  const need = PLANS[info.minPlan];
  const cur = PLANS[currentPlan()];
  return `
    <div class="app-header">🔒 Tính năng gói ${need.name}
      <button onclick="document.querySelector('[x-data]').__x.$data.nav('more')" style="float:right;background:none;border:0;color:white;font-size:24px;">←</button>
    </div>
    <div class="empty" style="padding:36px 20px 10px;">
      <div class="ico" style="font-size:54px;">${info.icon}</div>
      <h3 style="margin:12px 0 6px;">${info.label}</h3>
      <p style="color:var(--c-text-muted); font-size:14px;">Bạn đang dùng gói <strong>${cur.label}</strong>.<br/>Tính năng này thuộc gói <strong>${need.label}</strong> trở lên.</p>
    </div>
    <div class="card" style="margin-top:8px;">
      <div class="row">
        <div class="card-title">${need.label}</div>
        <span class="pill completed">${need.priceOnce}</span>
      </div>
      ${need.sub ? `<div class="card-meta">+ Truy xuất & cloud: <strong>${need.sub}</strong> · Tiên phong miễn phí 3 tháng</div>` : ''}
      <div class="card-meta" style="margin-top:6px;">Nâng gói chỉ trả phần chênh lệch · giữ nguyên thiết bị & dữ liệu</div>
      <button class="btn" style="margin-top:12px; width:100%;" onclick="window.open('https://ecosyntechglobal.com#pricing','_system')">Xem bảng giá & nâng gói</button>
      <button class="btn secondary" style="margin-top:8px; width:100%;" onclick="window.open('zalo://send?text=' + encodeURIComponent('Tôi muốn nâng gói ${need.name} - EcoSynTech Farm OS'),'_system')">📲 Liên hệ qua Zalo</button>
    </div>
  `;
}

if (typeof window !== 'undefined') window.planStore = { PLANS, hasFeature, currentPlan };
