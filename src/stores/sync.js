// Sync queue — IndexedDB-backed offline POST queue
// V3.1 FIX #5: KHÔNG silent-drop. Item lỗi 4xx sau 3 retry → chuyển Dead-letter,
// user thấy được, retry/export/xoá thủ công. Nhật ký canh tác không bao giờ mất âm thầm.
import { get, set, del, keys } from 'idb-keyval';
import { fallbackFetch } from '../api/fallback-client.js';

const PREFIX = 'queue:';
const DEAD_PREFIX = 'deadletter:';

async function listByPrefix(prefix) {
  const all = await keys();
  const ids = all.filter(k => typeof k === 'string' && k.startsWith(prefix));
  const items = [];
  for (const id of ids) {
    const v = await get(id);
    if (v) items.push({ id, ...v });
  }
  return items.sort((a, b) => a.ts - b.ts);
}

export const syncQueue = {
  _processLock: null,

  async enqueue(item) {
    const id = `${PREFIX}${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    item.ts = Date.now();
    item.retries = 0;
    await set(id, item);
    return id;
  },

  async list() { return listByPrefix(PREFIX); },

  async size() { return (await this.list()).length; },

  async processQueue() {
    if (this._processLock) return this._processLock;
    this._processLock = (async () => {
      let movedToDead = 0;
      try {
        const items = await this.list();
        for (const it of items) {
          try {
            const r = await fallbackFetch(it.path, {
              method: it.method || 'POST',
              body: typeof it.body === 'string' ? it.body : JSON.stringify(it.body)
            });
            if (r.ok || r.status === 201) {
              await del(it.id);
            } else if (r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429) {
              it.retries = (it.retries || 0) + 1;
              if (it.retries >= 3) {
                await this._moveToDead(it, `HTTP ${r.status}`);
                movedToDead++;
              } else {
                const { id, ...data } = it;
                await set(id, data);
              }
            } else {
              it.retries = (it.retries || 0) + 1;
              const { id, ...data } = it;
              await set(id, data);
            }
          } catch (err) {
            continue;
          }
        }
      } finally {
        this._processLock = null;
        if (movedToDead > 0 && typeof window !== 'undefined' && window.showToast) {
          window.showToast(`⚠ ${movedToDead} bản ghi sync lỗi — xem mục "Sync lỗi" trong Cài đặt`, 'err');
        }
      }
    })();
    return this._processLock;
  },

  async _moveToDead(it, reason) {
    const deadId = `${DEAD_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const { id, ...data } = it;
    await set(deadId, { ...data, deadReason: reason, deadAt: Date.now() });
    await del(id);
  },

  // ===== Dead-letter API (FIX #5) =====
  async listDead() { return listByPrefix(DEAD_PREFIX); },

  async deadSize() { return (await this.listDead()).length; },

  async retryDead(deadId) {
    const v = await get(deadId);
    if (!v) return;
    const { deadReason, deadAt, ...item } = v;
    item.retries = 0;
    item.ts = Date.now();
    const id = `${PREFIX}${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    await set(id, item);
    await del(deadId);
  },

  async retryAllDead() {
    const items = await this.listDead();
    for (const it of items) await this.retryDead(it.id);
  },

  async deleteDead(deadId) { await del(deadId); },

  async exportDead() {
    // Xuất JSON để không mất dữ liệu gốc dù backend từ chối
    const items = await this.listDead();
    return JSON.stringify(items, null, 2);
  },

  async clearAll() {
    const items = await this.list();
    for (const it of items) await del(it.id);
  }
};

if (typeof window !== 'undefined') window.syncQueue = syncQueue;
