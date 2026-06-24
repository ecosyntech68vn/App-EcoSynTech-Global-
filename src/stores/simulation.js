import { get, set } from 'idb-keyval';

const ACTIVE_KEY = 'sim:active';
const ZONES = ['Z1', 'Z2', 'Z3', 'Z4'];
const CROPS = ['Rau muống', 'Cà chua', 'Ớt chuông', 'Dưa leo', 'Xà lách'];

function rnd(min, max) { return Math.round((min + Math.random() * (max - min)) * 10) / 10; }

function generateZoneData(zoneId) {
  return {
    zoneId,
    name: `Zone ${zoneId}`,
    temp: rnd(22, 36),
    humidity: rnd(55, 90),
    ph: rnd(5.5, 7.5),
    ec: rnd(0.5, 3.0),
    water: rnd(30, 80),
    status: 'ok',
    soilMoisture: rnd(35, 75),
    light: rnd(200, 1200),
    crop: CROPS[Math.floor(Math.random() * CROPS.length)],
    updatedAt: Date.now()
  };
}

export const simulationStore = {
  async isActive() { return !!(await get(ACTIVE_KEY)); },

  async setActive(active) {
    await set(ACTIVE_KEY, !!active);
  },

  generatePayload() {
    return {
      zones: ZONES.map(generateZoneData),
      generatedAt: Date.now()
    };
  },

  generateAlerts(count) {
    const severities = ['info', 'warning', 'critical'];
    const messages = [
      'Nhiệt độ vượt ngưỡng', 'Độ ẩm đất thấp', 'PH bất thường',
      'EC cao', 'Cảm biến mất tín hiệu', 'Mực nước thấp',
      'Phát hiện sâu bệnh', 'Nguy cơ ngập úng'
    ];
    return Array.from({ length: count }, (_, i) => ({
      id: `sim_alert_${Date.now()}_${i}`,
      title: messages[Math.floor(Math.random() * messages.length)],
      severity: severities[Math.floor(Math.random() * severities.length)],
      zoneId: ZONES[Math.floor(Math.random() * ZONES.length)],
      createdAt: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      detail: 'Dữ liệu mô phỏng — không phải cảnh báo thật',
      status: 'open'
    }));
  },

  generateScheduleItems(count) {
    const actions = [
      { action: 'irrigation_on', icon: '💧', label: 'Bật tưới' },
      { action: 'fertilizer_dose', icon: '🧪', label: 'Bón phân' }
    ];
    return Array.from({ length: count }, (_, i) => {
      const a = actions[Math.floor(Math.random() * actions.length)];
      return {
        id: `sim_sch_${i}`,
        name: `${a.label} ${ZONES[i % ZONES.length]}`,
        action: a.action,
        zoneId: ZONES[i % ZONES.length],
        repeat: ['daily', 'weekdays', 'weekends', 'custom'][Math.floor(Math.random() * 4)],
        time: `${String(5 + Math.floor(Math.random() * 4)).padStart(2, '0')}:00`,
        duration: 15 + Math.floor(Math.random() * 30),
        enabled: Math.random() > 0.2,
        note: 'Dữ liệu mô phỏng'
      };
    });
  }
};

if (typeof window !== 'undefined') window.simulationStore = simulationStore;
