import { get, set, keys } from 'idb-keyval';

const MEMBER_KEY = 'htx:members';

export const memberStore = {
  async list() {
    return (await get(MEMBER_KEY)) || [];
  },

  async add({ name, phone, address, note }) {
    if (!name) throw new Error('Thiếu tên xã viên');
    const list = await this.list();
    const member = {
      id: 'mbr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name, phone: phone || '', address: address || '', note: note || '',
      createdAt: Date.now()
    };
    list.push(member);
    await set(MEMBER_KEY, list);
    return member;
  },

  async update(id, patch) {
    const list = await this.list();
    const idx = list.findIndex(m => m.id === id);
    if (idx < 0) throw new Error('Không tìm thấy xã viên');
    list[idx] = { ...list[idx], ...patch };
    await set(MEMBER_KEY, list);
    return list[idx];
  },

  async remove(id) {
    let list = await this.list();
    list = list.filter(m => m.id !== id);
    await set(MEMBER_KEY, list);
  },

  async byId(id) {
    return (await this.list()).find(m => m.id === id) || null;
  },

  async memberLots() {
    await import('../db/trace.js').then(m => m.lotStore.list());
  },

  async productionSummary() {
    const { lotStore } = await import('../db/trace.js');
    const members = await this.list();
    const lots = await lotStore.list();
    return members.map(m => {
      const memberLots = lots.filter(l => l.memberId === m.id);
      const harvested = memberLots.filter(l => l.harvest);
      const totalYield = harvested.reduce((s, l) => s + (l.harvest?.qty || 0), 0);
      return {
        member: m,
        totalLots: memberLots.length,
        activeLots: memberLots.filter(l => l.status === 'growing').length,
        harvestedLots: harvested.length,
        totalYield,
        estimatedRevenue: memberLots.reduce((s, l) => s + (l.budget?.expectedRevenue || 0), 0)
      };
    });
  }
};
