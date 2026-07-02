import { get, set } from 'idb-keyval';
import { authStore } from './auth.js';

const AUDIT_KEY = 'audit:log';
const MAX_ENTRIES = 500;

export const auditStore = {
  async all() { return (await get(AUDIT_KEY)) || []; },

  async log(event) {
    const all = await this.all();
    const { actor: _a, role: _r, id: _i, ts: _t, timestamp: _ts, ...safeEvent } = event || {};
    const entry = {
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ts: Date.now(),
      timestamp: new Date().toISOString(),
      actor: authStore.farmerId || 'unknown',
      role: authStore.role || 'farmer',
      ...safeEvent
    };
    all.unshift(entry);
    await set(AUDIT_KEY, all.slice(0, MAX_ENTRIES));
    return entry;
  },

  async logCommand({ deviceId, action, status, detail }) {
    return this.log({
      type: 'command',
      deviceId,
      action,
      status,
      detail: detail || `${action} → ${deviceId} (${status})`
    });
  },

  async logSchedule({ scheduleId, action, status, name }) {
    return this.log({
      type: 'schedule',
      scheduleId,
      action,
      status,
      detail: `${action} lịch "${name || scheduleId}" (${status})`
    });
  },

  async logAuth({ action, status, detail }) {
    return this.log({
      type: 'auth',
      action,
      status,
      detail: detail || `${action} (${status})`
    });
  },

  async logConfig({ action, status, detail }) {
    return this.log({
      type: 'config',
      action,
      status,
      detail: detail || `${action} cấu hình (${status})`
    });
  },

  async clear() {
    await set(AUDIT_KEY, []);
  },

  async byType(type) {
    const all = await this.all();
    return all.filter(e => e.type === type);
  },

  async recent(count = 50) {
    const all = await this.all();
    return all.slice(0, count);
  }
};

if (typeof window !== 'undefined') window.auditStore = auditStore;
