import { get, set } from 'idb-keyval';

const WORKER_KEY = 'labor:workers';
const ATTEND_KEY = 'labor:attendance';
const PAYROLL_KEY = 'labor:payroll';

const DEFAULT_ROLES = [
  { id: 'general', label: 'Lao động phổ thông' },
  { id: 'irrigator', label: 'Nhân viên tưới' },
  { id: 'sprayer', label: 'Phun thuốc' },
  { id: 'harvester', label: 'Thu hoạch' },
  { id: 'technician', label: 'Kỹ thuật' },
  { id: 'supervisor', label: 'Giám sát' }
];

function genId() { return `wrk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

function todayStr() { return new Date().toISOString().slice(0, 10); }

export const LABOR_ROLES = DEFAULT_ROLES;

export const laborStore = {
  async getAllWorkers() { return (await get(WORKER_KEY)) || []; },

  async addWorker({ name, phone, role, dailyRate }) {
    if (!name) return false;
    const list = await this.getAllWorkers();
    const w = {
      id: genId(),
      name: name.trim(),
      phone: (phone || '').trim(),
      role: role || 'general',
      dailyRate: +(dailyRate || 0),
      active: true,
      createdAt: Date.now()
    };
    list.unshift(w);
    await set(WORKER_KEY, list);
    return w;
  },

  async updateWorker(id, data) {
    const list = await this.getAllWorkers();
    const idx = list.findIndex(w => w.id === id);
    if (idx === -1) return false;
    list[idx] = { ...list[idx], ...data, id };
    await set(WORKER_KEY, list);
    return list[idx];
  },

  async deleteWorker(id) {
    let list = await this.getAllWorkers();
    list = list.filter(w => w.id !== id);
    await set(WORKER_KEY, list);
    return true;
  },

  async getAllAttendance(limit = 200) {
    const all = (await get(ATTEND_KEY)) || [];
    return all.slice(0, limit);
  },

  async getAttendanceByDate(date) {
    const all = await this.getAllAttendance(500);
    return all.filter(a => a.date === date);
  },

  async getWorkerAttendance(workerId, days = 30) {
    const all = await this.getAllAttendance(1000);
    const cutoff = Date.now() - days * 86400000;
    return all.filter(a => a.workerId === workerId && a.checkIn >= cutoff);
  },

  async checkIn(workerId, lotId, task) {
    const workers = await this.getAllWorkers();
    const w = workers.find(w => w.id === workerId);
    if (!w) return false;
    const entry = {
      id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 4)}`,
      workerId,
      workerName: w.name,
      date: todayStr(),
      checkIn: Date.now(),
      checkOut: 0,
      lotId: lotId || '',
      task: task || '',
      hours: 0,
      paid: false
    };
    const all = (await get(ATTEND_KEY)) || [];
    all.unshift(entry);
    await set(ATTEND_KEY, all.slice(0, 2000));
    return entry;
  },

  async checkOut(workerId) {
    const all = (await get(ATTEND_KEY)) || [];
    const today = todayStr();
    const entry = all.find(a => a.workerId === workerId && a.date === today && a.checkOut === 0);
    if (!entry) return false;
    entry.checkOut = Date.now();
    entry.hours = Math.round((entry.checkOut - entry.checkIn) / 3600000 * 10) / 10;
    await set(ATTEND_KEY, all);
    return entry;
  },

  async calculatePayroll(weekStart) {
    const all = await this.getAllAttendance(1000);
    const workers = await this.getAllWorkers();
    const start = new Date(weekStart).getTime();
    const end = start + 7 * 86400000;
    const weekEntries = all.filter(a => a.checkIn >= start && a.checkIn < end && a.checkOut > 0);
    const result = [];
    for (const w of workers) {
      const entries = weekEntries.filter(a => a.workerId === w.id);
      if (!entries.length) continue;
      const daysWorked = new Set(entries.map(a => a.date)).size;
      const hoursTotal = entries.reduce((s, a) => s + (a.hours || 0), 0);
      const amount = daysWorked * (w.dailyRate || 0);
      result.push({
        workerId: w.id,
        workerName: w.name,
        role: w.role,
        dailyRate: w.dailyRate,
        daysWorked,
        hoursTotal,
        amount,
        entries
      });
    }
    return result;
  },

  async savePayroll({ weekStart, workers, totalAmount }) {
    const payrolls = (await get(PAYROLL_KEY)) || [];
    const entry = {
      id: `pay_${Date.now()}`,
      weekStart,
      createdAt: Date.now(),
      workers: workers.map(w => ({
        workerId: w.workerId,
        workerName: w.workerName,
        daysWorked: w.daysWorked,
        amount: w.amount,
        paid: false
      })),
      totalAmount
    };
    payrolls.unshift(entry);
    await set(PAYROLL_KEY, payrolls.slice(0, 200));
    return entry;
  },

  async markPaid(payrollId, workerId) {
    const payrolls = (await get(PAYROLL_KEY)) || [];
    const p = payrolls.find(p => p.id === payrollId);
    if (!p) return false;
    const w = p.workers.find(w => w.workerId === workerId);
    if (!w) return false;
    w.paid = true;
    await set(PAYROLL_KEY, payrolls);
    return true;
  },

  async getPayrollHistory() { return (await get(PAYROLL_KEY)) || []; }
};

if (typeof window !== 'undefined') window.laborStore = laborStore;
