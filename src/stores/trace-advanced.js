import { get, set } from 'idb-keyval';
import { auditStore } from './audit.js';

const GENEALOGY_KEY = 'trace:genealogy';
const PROCESS_KEY = 'trace:processing';
const INSPECT_KEY = 'trace:inspection';
const COLDCHAIN_KEY = 'trace:coldchain';
const RECALL_KEY = 'trace:recalls';

function genId(prefix) { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

// ============================================================
// PHẢ HỆ LÔ (Lot Genealogy) — splitting / merging
// ============================================================
export const genealogyStore = {
  async getAll() { return (await get(GENEALOGY_KEY)) || []; },

  async getByLot(lotId) {
    const all = await this.getAll();
    return all.filter(g => g.sourceLotId === lotId || g.targetLotId === lotId);
  },

  async getTree(lotId) {
    const all = await this.getAll();
    const visited = new Set();
    const children = [];
    const parents = [];

    function findParents(id) {
      if (visited.has(id)) return;
      visited.add(id);
      for (const g of all) {
        if (g.targetLotId === id) {
          parents.push({ lotId: g.sourceLotId, type: g.type, date: g.date, qty: g.quantity });
          findParents(g.sourceLotId);
        }
      }
    }

    function findChildren(id) {
      const stack = [id];
      while (stack.length) {
        const cid = stack.pop();
        for (const g of all) {
          if (g.sourceLotId === cid) {
            children.push({ lotId: g.targetLotId, type: g.type, date: g.date, qty: g.quantity });
            stack.push(g.targetLotId);
          }
        }
      }
    }

    findParents(lotId);
    findChildren(lotId);
    return { parents, children };
  },

  async addSplit({ sourceLotId, targetLotIds, quantities, date }) {
    if (!sourceLotId || !targetLotIds?.length) return false;
    const all = await this.getAll();
    const entries = targetLotIds.map((id, i) => ({
      id: genId('gen'),
      sourceLotId,
      targetLotId: id,
      type: 'split',
      quantity: (quantities && quantities[i]) || 0,
      date: date || new Date().toISOString().slice(0, 10),
      createdAt: Date.now()
    }));
    all.push(...entries);
    await set(GENEALOGY_KEY, all.slice(-2000));
    await auditStore.logConfig({ action: 'lot_split', status: 'ok', detail: `${sourceLotId} → ${targetLotIds.length} lots` });
    return entries;
  },

  async addMerge({ targetLotId, sourceLotIds, quantities, date }) {
    if (!targetLotId || !sourceLotIds?.length) return false;
    const all = await this.getAll();
    const entries = sourceLotIds.map((id, i) => ({
      id: genId('gen'),
      sourceLotId: id,
      targetLotId,
      type: 'merge',
      quantity: (quantities && quantities[i]) || 0,
      date: date || new Date().toISOString().slice(0, 10),
      createdAt: Date.now()
    }));
    all.push(...entries);
    await set(GENEALOGY_KEY, all.slice(-2000));
    await auditStore.logConfig({ action: 'lot_merge', status: 'ok', detail: `${sourceLotIds.length} lots → ${targetLotId}` });
    return entries;
  }
};

// ============================================================
// CHẾ BIẾN (Processing / Transformation)
// ============================================================
export const processingStore = {
  async getAll() { return (await get(PROCESS_KEY)) || []; },

  async add({ name, inputLots, outputProduct, outputQuantity, unit, cost, date, notes }) {
    if (!name || !inputLots?.length || !outputProduct) return false;
    const all = await this.getAll();
    const entry = {
      id: genId('proc'),
      name: name.trim(),
      inputLots: inputLots.map(i => ({ lotId: i.lotId, quantity: +i.quantity, unit: i.unit || 'kg' })),
      outputProduct: outputProduct.trim(),
      outputQuantity: +outputQuantity,
      unit: unit || 'kg',
      cost: +(cost || 0),
      date: date || new Date().toISOString().slice(0, 10),
      notes: notes || '',
      createdAt: Date.now()
    };
    all.unshift(entry);
    await set(PROCESS_KEY, all.slice(0, 1000));
    await auditStore.logConfig({ action: 'processing_add', status: 'ok', detail: `${name}: ${inputLots.length} inputs → ${outputProduct}` });
    return entry;
  },

  async getByLot(lotId) {
    const all = await this.getAll();
    return all.filter(p => p.inputLots.some(i => i.lotId === lotId) || p.outputProduct === lotId);
  },

  async getCostSummary(dateFrom, dateTo) {
    const all = await this.getAll();
    const filtered = all.filter(p => {
      if (!dateFrom && !dateTo) return true;
      const d = p.date;
      return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
    });
    return {
      totalProcesses: filtered.length,
      totalCost: filtered.reduce((s, p) => s + (p.cost || 0), 0),
      totalOutput: filtered.reduce((s, p) => s + (p.outputQuantity || 0), 0),
      items: filtered.slice(0, 50)
    };
  }
};

// ============================================================
// KIỂM ĐỊNH CHẤT LƯỢNG (Quality Inspection)
// ============================================================
export const inspectionStore = {
  async getAll() { return (await get(INSPECT_KEY)) || []; },

  async add({ lotId, type, result, ph, brix, weight, moisture, grade, notes, inspector }) {
    if (!lotId || !type) return false;
    const all = await this.getAll();
    const entry = {
      id: genId('insp'),
      lotId,
      type, // 'harvest', 'pre_shipment', 'incoming', 'storage'
      result: result || 'pass', // 'pass', 'fail', 'conditional'
      ph: ph != null ? +ph : null,
      brix: brix != null ? +brix : null,
      weight: weight != null ? +weight : null,
      moisture: moisture != null ? +moisture : null,
      grade: grade || '', // 'A', 'B', 'C', 'export', 'local'
      notes: notes || '',
      inspector: inspector || '',
      date: new Date().toISOString().slice(0, 10),
      createdAt: Date.now()
    };
    all.unshift(entry);
    await set(INSPECT_KEY, all.slice(0, 2000));
    await auditStore.logConfig({ action: 'inspection_add', status: 'ok', detail: `${lotId} — ${type} → ${result}` });
    return entry;
  },

  async getByLot(lotId) {
    const all = await this.getAll();
    return all.filter(i => i.lotId === lotId);
  },

  async getSummary(lotId) {
    const inspections = lotId ? await this.getByLot(lotId) : await this.getAll();
    const pass = inspections.filter(i => i.result === 'pass').length;
    const fail = inspections.filter(i => i.result === 'fail').length;
    const conditional = inspections.filter(i => i.result === 'conditional').length;
    return { total: inspections.length, pass, fail, conditional, passRate: inspections.length ? Math.round(pass / inspections.length * 100) : 0 };
  }
};

// ============================================================
// CHUỖI LẠNH (Cold Chain Temperature Logs)
// ============================================================
export const coldChainStore = {
  async getAll() { return (await get(COLDCHAIN_KEY)) || []; },

  async add({ lotId, location, temp, humidity, deviceId, notes }) {
    if (!lotId || temp == null) return false;
    const all = await this.getAll();
    const entry = {
      id: genId('cold'),
      lotId,
      location: location || '',
      temp: +temp,
      humidity: humidity != null ? +humidity : null,
      deviceId: deviceId || '',
      notes: notes || '',
      timestamp: Date.now(),
      date: new Date().toISOString()
    };
    all.unshift(entry);
    await set(COLDCHAIN_KEY, all.slice(0, 5000));
    return entry;
  },

  async getByLot(lotId) {
    const all = await this.getAll();
    return all.filter(c => c.lotId === lotId);
  },

  async getBreaches(lotId, minTemp, maxTemp) {
    const all = lotId ? await this.getByLot(lotId) : await this.getAll();
    const breaches = all.filter(c => c.temp < minTemp || c.temp > maxTemp);
    return { count: breaches.length, breaches: breaches.slice(0, 50) };
  },

  async getSummary(lotId) {
    const logs = lotId ? await this.getByLot(lotId) : await this.getAll();
    if (!logs.length) return null;
    const temps = logs.map(l => l.temp);
    return {
      count: logs.length,
      avgTemp: Math.round(temps.reduce((s, t) => s + t, 0) / temps.length * 10) / 10,
      minTemp: Math.min(...temps),
      maxTemp: Math.max(...temps),
      lastLog: logs[0]
    };
  }
};

// ============================================================
// THU HỒI SẢN PHẨM (Recall Management)
// ============================================================
export const recallStore = {
  async getAll() { return (await get(RECALL_KEY)) || []; },

  async add({ lotId, reason, severity, affectedQuantity, unit, scope, action, notes }) {
    if (!lotId || !reason) return false;
    const all = await this.getAll();
    const entry = {
      id: genId('recall'),
      lotId,
      reason: reason.trim(),
      severity: severity || 'medium', // 'critical', 'high', 'medium', 'low'
      affectedQuantity: +(affectedQuantity || 0),
      unit: unit || 'kg',
      scope: scope || '', // 'internal', 'customer', 'public'
      action: action || '', // 'destroy', 'rework', 'return', 'discount'
      notes: notes || '',
      status: 'open', // 'open', 'in_progress', 'resolved', 'closed'
      createdAt: Date.now(),
      date: new Date().toISOString().slice(0, 10),
      resolvedAt: null
    };
    all.unshift(entry);
    await set(RECALL_KEY, all.slice(0, 500));
    await auditStore.logConfig({ action: 'recall_created', status: 'ok', detail: `${lotId} — ${reason} (${severity})` });
    return entry;
  },

  async update(id, data) {
    const all = await this.getAll();
    const idx = all.findIndex(r => r.id === id);
    if (idx === -1) return false;
    all[idx] = { ...all[idx], ...data, id };
    if (data.status === 'resolved' || data.status === 'closed') {
      all[idx].resolvedAt = Date.now();
    }
    await set(RECALL_KEY, all);
    return all[idx];
  },

  async getOpen() {
    const all = await this.getAll();
    return all.filter(r => r.status === 'open' || r.status === 'in_progress');
  },

  async getByLot(lotId) {
    const all = await this.getAll();
    return all.filter(r => r.lotId === lotId);
  },

  async traceForward(lotId) {
    const results = [];
    const visited = new Set();
    const queue = [lotId];
    const geneall = await genealogyStore.getAll();

    while (queue.length) {
      const cur = queue.shift();
      if (visited.has(cur)) continue;
      visited.add(cur);
      for (const g of geneall) {
        if (g.sourceLotId === cur) {
          results.push({ lotId: g.targetLotId, type: g.type, date: g.date });
          queue.push(g.targetLotId);
        }
      }
    }
    return results;
  },

  async traceBackward(lotId) {
    const results = [];
    const visited = new Set();
    const queue = [lotId];
    const geneall = await genealogyStore.getAll();

    while (queue.length) {
      const cur = queue.shift();
      if (visited.has(cur)) continue;
      visited.add(cur);
      for (const g of geneall) {
        if (g.targetLotId === cur) {
          results.push({ lotId: g.sourceLotId, type: g.type, date: g.date });
          queue.push(g.sourceLotId);
        }
      }
    }
    return results;
  },

  async getSummary() {
    const all = await this.getAll();
    const open = all.filter(r => r.status === 'open').length;
    const inProgress = all.filter(r => r.status === 'in_progress').length;
    const resolved = all.filter(r => r.status === 'resolved' || r.status === 'closed').length;
    const critical = all.filter(r => r.severity === 'critical' && r.status !== 'closed').length;
    return { total: all.length, open, inProgress, resolved, critical, urgent: critical + open };
  }
};

if (typeof window !== 'undefined') {
  window.genealogyStore = genealogyStore;
  window.processingStore = processingStore;
  window.inspectionStore = inspectionStore;
  window.coldChainStore = coldChainStore;
  window.recallStore = recallStore;
}
