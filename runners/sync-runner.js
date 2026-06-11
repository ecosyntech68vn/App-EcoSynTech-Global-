// Background runner — runs in native worker thread every 15 min (Workmanager)
// V3.1 FIX #6: alert hoạt động cả khi app bị KILL.
// Runner context có: fetch, CapacitorKV, CapacitorNotifications (Background Runner v2 API).
// WebView không truy cập được KV của runner → app dispatch event 'saveConfig' để nạp url/token.
// IMPORTANT: This file runs OUTSIDE the WebView, no DOM access, no IndexedDB.

// App gọi sau khi login / đổi settings: dispatchEvent('saveConfig', {url, token})
addEventListener('saveConfig', (resolve, reject, args) => {
  try {
    CapacitorKV.set('cfg_url', String(args.url || ''));
    CapacitorKV.set('cfg_token', String(args.token || ''));
    resolve();
  } catch (e) { reject(e); }
});

// Scheduled mỗi 15 phút bởi Workmanager (capacitor.config BackgroundRunner)
addEventListener('sync', async (resolve, reject) => {
  try {
    let url = '', token = '';
    try { url = (CapacitorKV.get('cfg_url') || {}).value || ''; } catch (_) {}
    try { token = (CapacitorKV.get('cfg_token') || {}).value || ''; } catch (_) {}
    if (!url || !token || token.startsWith('local-')) {
      // Chưa có config server hoặc đang chạy local-only → không làm gì
      resolve();
      return;
    }

    const r = await fetch(url.replace(/\/$/, '') + '/api/alerts?status=open', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!r.ok) { resolve(); return; }
    const d = await r.json();
    const alerts = Array.isArray(d) ? d : (d.items || d.alerts || []);

    // Dedupe bằng KV seen list
    let seen = [];
    try { seen = JSON.parse((CapacitorKV.get('seen_alerts') || {}).value || '[]'); } catch (_) {}
    const fresh = alerts.filter(a => !seen.includes(a.id || a._id));

    for (const a of fresh.slice(0, 5)) { // tối đa 5 notif/lần — tránh spam
      const sev = (a.severity || a.level || 'info').toLowerCase();
      const icon = sev === 'critical' ? '🚨' : sev === 'warning' ? '⚠' : 'ℹ';
      try {
        CapacitorNotifications.schedule([{
          id: Math.floor(Math.random() * 2147483647),
          title: icon + ' ' + (a.title || a.message || 'Cảnh báo mới'),
          body: 'Zone ' + (a.zoneId || a.zone || '-') + ' · ' + (a.severity || a.level || '')
        }]);
      } catch (_) {}
    }

    const ids = alerts.map(a => a.id || a._id).filter(Boolean);
    const merged = Array.from(new Set(seen.concat(ids))).slice(-200);
    try { CapacitorKV.set('seen_alerts', JSON.stringify(merged)); } catch (_) {}

    console.log('[bg-runner] checked alerts:', alerts.length, 'new:', fresh.length);
    resolve();
  } catch (e) {
    // Offline / lỗi mạng — bình thường, lần sau thử lại
    resolve();
  }
});
