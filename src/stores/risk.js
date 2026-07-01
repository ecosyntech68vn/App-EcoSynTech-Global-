import { get, set } from 'idb-keyval';
import { lotStore } from '../db/trace.js';

const CACHE_KEY = 'cache:risk:weather';

export const riskStore = {
  async assess(zoneId) {
    const lots = await lotStore.list();
    const zoneLots = lots.filter(l => l.zoneId === zoneId && l.status === 'growing');
    const result = {
      zoneId,
      drought: { risk: 'low', score: 0, reason: '' },
      flood: { risk: 'low', score: 0, reason: '' },
      activeCrops: zoneLots.map(l => ({ crop: l.crop, plantedAt: l.plantedAt })),
    };

    // Check weather forecast for rain
    try {
      const weatherData = await getWeatherForecast();
      if (weatherData && weatherData.list) {
        const now = Date.now() / 1000;
        const next3d = weatherData.list.filter(it => it.dt > now && it.dt < now + 3 * 86400);

        // Flood risk: heavy rain 3-day total
        const rainTotal = next3d.reduce((s, it) => s + ((it.rain && it.rain['3h']) || 0), 0);
        if (rainTotal > 100) {
          result.flood = { risk: 'high', score: Math.min(100, rainTotal), reason: `Mưa lớn ${rainTotal.toFixed(0)}mm/3 ngày — nguy cơ ngập úng` };
        } else if (rainTotal > 50) {
          result.flood = { risk: 'medium', score: rainTotal, reason: `Mưa ${rainTotal.toFixed(0)}mm/3 ngày — cần kiểm tra thoát nước` };
        } else {
          result.flood = { risk: 'low', score: rainTotal, reason: `Lượng mưa ${rainTotal.toFixed(0)}mm/3 ngày — bình thường` };
        }

        // Drought risk: no rain + high temp for 3 days
        const noRainDays = next3d.filter(it => !(it.rain && it.rain['3h'] > 0)).length;
        const highTemp = next3d.some(it => it.main.temp > 35);
        if (noRainDays >= 6 && highTemp) {
          result.drought = { risk: 'high', score: 80, reason: 'Nắng nóng >35°C, không mưa — nguy cơ hạn. Cần tưới bổ sung.' };
        } else if (noRainDays >= 4) {
          result.drought = { risk: 'medium', score: 50, reason: `Không mưa ${noRainDays}/8 kỳ — theo dõi độ ẩm đất` };
        } else {
          result.drought = { risk: 'low', score: 10, reason: 'Độ ẩm bình thường' };
        }
      }
    } catch (_) {
      result.drought.reason = 'Không có dữ liệu thời tiết (cần API key)';
      result.flood.reason = 'Không có dữ liệu thời tiết';
    }

    // Check soil moisture if available
    try {
      const { keys } = await import('idb-keyval');
      const allKeys = await keys();
      const soilKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith('soil:'));
      if (soilKeys.length > 0) {
        const { get } = await import('idb-keyval');
        const samples = [];
        for (const k of soilKeys) {
          const v = await get(k);
          if (v && v.moisture != null) samples.push(v);
        }
        if (samples.length > 0) {
          const avgMoisture = samples.reduce((s, v) => s + parseFloat(v.moisture || 0), 0) / samples.length;
          if (avgMoisture < 20) {
            result.drought = {
              risk: 'high', score: 90,
              reason: `Độ ẩm đất ${avgMoisture.toFixed(0)}% — dưới ngưỡng an toàn. Cần tưới ngay.`
            };
          } else if (avgMoisture > 85) {
            result.flood = {
              risk: 'high', score: 90,
              reason: `Độ ẩm đất ${avgMoisture.toFixed(0)}% — bão hoà, nguy cơ ngập rễ.`
            };
          }
        }
      }
    } catch (_) {}

    return result;
  },

  async assessAll() {
    const lots = await lotStore.list();
    const zones = [...new Set(lots.filter(l => l.zoneId).map(l => l.zoneId))].sort();
    const results = [];
    for (const z of zones) {
      results.push(await this.assess(z));
    }
    return results;
  }
};

async function getWeatherForecast() {
  const cached = await get(CACHE_KEY);
  if (cached && (Date.now() - cached.ts) < 2 * 3600 * 1000) return cached.data;
  const { authStore } = await import('../stores/auth.js');
  if (!authStore.weatherApiKey) return null;
  try {
    const r = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=10.8231&lon=106.6297&appid=${authStore.weatherApiKey}&units=metric`);
    if (!r.ok) return null;
    const data = await r.json();
    await set(CACHE_KEY, { data, ts: Date.now() });
    return data;
  } catch { return null; }
}
