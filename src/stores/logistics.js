import { get, set } from 'idb-keyval';

const SHIPMENT_KEY = 'logistics:shipments';
const CARRIER_KEY = 'logistics:carriers';

const CARRIERS = [
  { id: 'vnpost', name: 'VNPost (Bưu điện)', apiBase: 'https://api.vnpost.vn', trackingUrl: 'https://vnpost.vn/tracking' },
  { id: 'viettelpost', name: 'Viettel Post', apiBase: 'https://api.viettelpost.com.vn', trackingUrl: 'https://viettelpost.com.vn/tracking' },
  { id: 'ghn', name: 'GHN (Giao Hàng Nhanh)', apiBase: 'https://api.ghn.vn', trackingUrl: 'https://ghn.vn/tracking' },
  { id: 'ghtk', name: 'GHTK (Giao Hàng Tiết Kiệm)', apiBase: 'https://api.ghtk.vn', trackingUrl: 'https://ghtk.vn/tracking' },
  { id: 'other', name: 'Hãng khác', apiBase: '', trackingUrl: '' }
];

function genId() { return `shp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

export const CARRIER_LIST = CARRIERS;

export const logisticsStore = {
  // ============================================================
  // TẠO VẬN ĐƠN
  // ============================================================

  async createShipment({ carrierId, contractId, batchId, senderName, senderPhone, senderAddr,
    receiverName, receiverPhone, receiverAddr, weight, cod, notes }) {
    if (!carrierId || !receiverName) return null;
    const list = await this.getAll();
    const shipment = {
      id: genId(),
      carrierId,
      contractId: contractId || '',
      batchId: batchId || '',
      senderName: senderName || '',
      senderPhone: senderPhone || '',
      senderAddr: senderAddr || '',
      receiverName: receiverName.trim(),
      receiverPhone: receiverPhone || '',
      receiverAddr: receiverAddr || '',
      weight: +(weight || 0),
      cod: +(cod || 0),
      notes: notes || '',
      trackingCode: '',
      trackingUrl: '',
      status: 'pending', // pending, created, in_transit, delivered, failed
      statusHistory: [{ status: 'pending', ts: Date.now(), note: 'Chờ tạo vận đơn' }],
      createdAt: Date.now(),
      date: new Date().toISOString().slice(0, 10)
    };
    list.unshift(shipment);
    await set(SHIPMENT_KEY, list.slice(0, 500));
    return shipment;
  },

  async updateTracking(id, trackingCode) {
    const list = await this.getAll();
    const idx = list.findIndex(s => s.id === id);
    if (idx === -1) return false;
    const carrier = CARRIERS.find(c => c.id === list[idx].carrierId);
    list[idx].trackingCode = trackingCode;
    list[idx].trackingUrl = carrier ? `${carrier.trackingUrl}/${trackingCode}` : '';
    list[idx].status = 'created';
    list[idx].statusHistory.push({ status: 'created', ts: Date.now(), note: `Mã vận đơn: ${trackingCode}` });
    await set(SHIPMENT_KEY, list);
    return list[idx];
  },

  async updateStatus(id, status, note) {
    const list = await this.getAll();
    const idx = list.findIndex(s => s.id === id);
    if (idx === -1) return false;
    list[idx].status = status;
    list[idx].statusHistory.push({ status, ts: Date.now(), note: note || '' });
    await set(SHIPMENT_KEY, list);
    return list[idx];
  },

  // ============================================================
  // TRA CỨU
  // ============================================================

  async getAll() { return (await get(SHIPMENT_KEY)) || []; },

  async getById(id) {
    const list = await this.getAll();
    return list.find(s => s.id === id) || null;
  },

  async getByContract(contractId) {
    const list = await this.getAll();
    return list.filter(s => s.contractId === contractId);
  },

  async getByBatch(batchId) {
    const list = await this.getAll();
    return list.filter(s => s.batchId === batchId);
  },

  // ============================================================
  // TRA CỨU VẬN ĐƠN TRỰC TIẾP (VNPost / ViettelPost)
  // ============================================================

  async lookupTracking(trackingCode, carrierId) {
    if (!trackingCode || !carrierId) return null;
    const carrier = CARRIERS.find(c => c.id === carrierId);
    if (!carrier) return null;

    // In real app, call actual carrier API:
    // VNPost: GET https://api.vnpost.vn/order/v2/orders/{trackingCode}
    // ViettelPost: GET https://api.viettelpost.com.vn/api/orders/{trackingCode}

    // For now, return simulated tracking data
    const statuses = [
      { status: 'picked_up', label: 'Đã lấy hàng', icon: '📦' },
      { status: 'in_transit', label: 'Đang vận chuyển', icon: '🚚' },
      { status: 'arrived_hub', label: 'Đến trung chuyển', icon: '🏭' },
      { status: 'out_for_delivery', label: 'Đang giao', icon: '🚛' },
      { status: 'delivered', label: 'Đã giao', icon: '✅' }
    ];

    return {
      carrier: carrier.name,
      trackingCode,
      trackingUrl: `${carrier.trackingUrl}/${trackingCode}`,
      currentStatus: 'in_transit',
      currentLabel: 'Đang vận chuyển',
      estimatedDelivery: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      events: statuses.slice(0, 3).map((s, i) => ({
        status: s.status,
        label: s.label,
        icon: s.icon,
        timestamp: new Date(Date.now() - (2 - i) * 86400000).toISOString(),
        location: ['Hà Nội', 'TP Hồ Chí Minh', 'Đà Nẵng'][i] || ''
      }))
    };
  },

  // ============================================================
  // THỐNG KÊ
  // ============================================================

  async getSummary() {
    const all = await this.getAll();
    const pending = all.filter(s => s.status === 'pending').length;
    const created = all.filter(s => s.status === 'created').length;
    const inTransit = all.filter(s => s.status === 'in_transit').length;
    const delivered = all.filter(s => s.status === 'delivered').length;
    const failed = all.filter(s => s.status === 'failed').length;
    const totalCod = all.reduce((s, sh) => s + (sh.cod || 0), 0);
    return { total: all.length, pending, created, inTransit, delivered, failed, totalCod };
  },

  async delete(id) {
    let list = await this.getAll();
    list = list.filter(s => s.id !== id);
    await set(SHIPMENT_KEY, list);
  }
};

if (typeof window !== 'undefined') window.logisticsStore = logisticsStore;
