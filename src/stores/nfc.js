// NFC Store — Tap-to-Trace
// Web NFC API (Chrome Android 89+) — không cần plugin Capacitor
import { get, set } from 'idb-keyval';

const NFC_REGISTRY_KEY = 'nfc:tags';

// Mock implementation for testing (trình duyệt desktop không có NFC)
let mockMode = typeof window === 'undefined' || !('NDEFReader' in window);

export function enableMock() { mockMode = true; }
export function disableMock() { mockMode = !('NDEFReader' in window); }

export const nfcStore = {
  async canRead() {
    if (mockMode) return false;
    return 'NDEFReader' in window;
  },

  // Ghi URL + lot code lên tag NFC
  async writeTag(lotCode, traceUrl) {
    if (mockMode) throw new Error('NFC không khả dụng trên trình duyệt này');
    try {
      const ndef = new NDEFReader();
      await ndef.write({
        records: [{
          recordType: 'url',
          data: traceUrl
        }]
      });
      // Ghi lại tag UID vào registry
      return { success: true, tagUrl: traceUrl };
    } catch (err) {
      throw new Error('Lỗi ghi NFC: ' + err.message);
    }
  },

  // Đọc tag NFC — trả về URL
  async readTag() {
    if (mockMode) throw new Error('NFC không khả dụng');
    try {
      const ndef = new NDEFReader();
      await ndef.scan();
      return new Promise((resolve, reject) => {
        ndef.addEventListener('reading', (e) => {
          const url = e.message.records.find(r => r.recordType === 'url')?.data;
          const tagId = e.serialNumber;
          if (url) resolve({ url: new TextDecoder().decode(url), tagId });
          else reject(new Error('Tag không chứa URL'));
        });
        ndef.addEventListener('readingerror', () => reject(new Error('Lỗi đọc tag')));
        setTimeout(() => reject(new Error('Timeout — không tìm thấy tag')), 30000);
      });
    } catch (err) {
      throw new Error('Lỗi đọc NFC: ' + err.message);
    }
  },

  // Forward traceability — ghi nhận checkpoint
  async recordRead(lotCode, tagId, location) {
    const registry = await this.getRegistry();
    const entry = {
      tagId,
      lotCode,
      location: location || 'unknown',
      readAt: Date.now()
    };
    registry.push(entry);
    await set(NFC_REGISTRY_KEY, registry);
    return entry;
  },

  async getRegistry() {
    return (await get(NFC_REGISTRY_KEY)) || [];
  },

  async getReadHistory(lotCode) {
    const registry = await this.getRegistry();
    return registry.filter(e => e.lotCode === lotCode).sort((a, b) => b.readAt - a.readAt);
  },

  // Mock cho testing — mô phỏng đọc/ghi
  async _mockWrite(lotCode, traceUrl) {
    if (!mockMode) return this.writeTag(lotCode, traceUrl);
    const id = 'nfc_' + Date.now().toString(36);
    await set('nfc:mock:' + id, { lotCode, traceUrl, writtenAt: Date.now() });
    return { success: true, tagId: id, tagUrl: traceUrl, mock: true };
  },

  async _mockRead() {
    return { url: 'https://ecosyntech.com/trace/EST-F1-260701-01', tagId: 'MOCK_TAG_001', mock: true };
  }
};
