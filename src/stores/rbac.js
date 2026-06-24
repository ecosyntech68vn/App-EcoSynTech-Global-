import { get, set } from 'idb-keyval';
import { authStore } from './auth.js';

const KEY = 'rbac:role';

export const ROLES = {
  owner: {
    label: 'Chủ sở hữu',
    label_en: 'Owner',
    level: 100,
    can: ['*']
  },
  manager: {
    label: 'Quản lý',
    label_en: 'Manager',
    level: 70,
    can: [
      'sensor.view', 'sensor.control',
      'alert.view', 'alert.ack',
      'log.create', 'log.view',
      'task.create', 'task.assign', 'task.complete',
      'report.view', 'report.export',
      'trace.view', 'trace.create',
      'order.view', 'order.create', 'order.confirm',
      'finance.view', 'finance.create',
      'labor.view', 'labor.create',
      'equipment.view', 'equipment.create',
      'contract.view', 'contract.create',
      'soil.view',
      'blockchain.view',
      'logistics.view',
      'inventory.view', 'inventory.create',
      'settings.view'
    ]
  },
  worker: {
    label: 'Nhân công',
    label_en: 'Worker',
    level: 40,
    can: [
      'sensor.view',
      'alert.view',
      'log.create', 'log.view',
      'task.view', 'task.complete',
      'trace.view',
      'order.view',
      'labor.view',
      'inventory.view'
    ]
  },
  auditor: {
    label: 'Kiểm toán',
    label_en: 'Auditor',
    level: 50,
    can: [
      'sensor.view',
      'alert.view',
      'log.view',
      'task.view',
      'report.view', 'report.export',
      'trace.view',
      'order.view',
      'finance.view',
      'labor.view',
      'contract.view',
      'blockchain.view',
      'logistics.view',
      'inventory.view',
      'settings.view'
    ]
  }
};

export const rbacStore = {
  async loadRole() {
    return (await get(KEY)) || 'owner';
  },
  async setRole(role) {
    await set(KEY, role);
  },
  getRole() {
    return authStore?.role || 'owner';
  },
  can(permission) {
    const role = this.getRole();
    const cfg = ROLES[role];
    if (!cfg) return false;
    if (cfg.can.includes('*')) return true;
    return cfg.can.includes(permission);
  },
  canAny(permissions) {
    return permissions.some(p => this.can(p));
  },
  require(permission) {
    if (!this.can(permission)) throw new Error('Bạn không có quyền thực hiện thao tác này');
  }
};
