import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStore = {};
vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key) => mockStore[key] ?? null),
  set: vi.fn(async (key, val) => { mockStore[key] = val; }),
  del: vi.fn(async (key) => { delete mockStore[key]; }),
  keys: vi.fn(async () => Object.keys(mockStore))
}));

vi.mock('../stores/auth.js', () => ({
  authStore: {
    get role() { return mockStore['_test_role'] || 'owner'; },
    set role(v) { mockStore['_test_role'] = v; },
    farmerId: 'test-farmer'
  }
}));

let rbacStore, ROLES;

describe('rbacStore', () => {
  beforeEach(async () => {
    Object.keys(mockStore).forEach(k => delete mockStore[k]);
    const mod = await import('../stores/rbac.js');
    rbacStore = mod.rbacStore;
    ROLES = mod.ROLES;
  });

  it('should have 4 roles defined', () => {
    expect(Object.keys(ROLES)).toEqual(['owner', 'manager', 'worker', 'auditor']);
  });

  it('should allow owner to do everything', () => {
    mockStore['_test_role'] = 'owner';
    expect(rbacStore.can('*')).toBe(true);
    expect(rbacStore.can('finance.view')).toBe(true);
    expect(rbacStore.can('settings.view')).toBe(true);
  });

  it('should allow worker to view sensors but not control', () => {
    mockStore['_test_role'] = 'worker';
    expect(rbacStore.can('sensor.view')).toBe(true);
    expect(rbacStore.can('sensor.control')).toBe(false);
  });

  it('should block worker from finance', () => {
    mockStore['_test_role'] = 'worker';
    expect(rbacStore.can('finance.view')).toBe(false);
    expect(rbacStore.can('finance.create')).toBe(false);
  });

  it('should allow manager to create orders', () => {
    mockStore['_test_role'] = 'manager';
    expect(rbacStore.can('order.view')).toBe(true);
    expect(rbacStore.can('order.create')).toBe(true);
    expect(rbacStore.can('order.confirm')).toBe(true);
  });

  it('should allow auditor to view but not modify', () => {
    mockStore['_test_role'] = 'auditor';
    expect(rbacStore.can('finance.view')).toBe(true);
    expect(rbacStore.can('finance.create')).toBe(false);
    expect(rbacStore.can('order.view')).toBe(true);
    expect(rbacStore.can('order.create')).toBe(false);
  });

  it('should allow auditor to export reports', () => {
    mockStore['_test_role'] = 'auditor';
    expect(rbacStore.can('report.view')).toBe(true);
    expect(rbacStore.can('report.export')).toBe(true);
  });

  it('should block worker from blockchain access', () => {
    mockStore['_test_role'] = 'worker';
    expect(rbacStore.can('blockchain.view')).toBe(false);
  });

  it('should handle canAny correctly', () => {
    mockStore['_test_role'] = 'worker';
    expect(rbacStore.canAny(['finance.view', 'sensor.view'])).toBe(true);
    expect(rbacStore.canAny(['finance.view', 'blockchain.view'])).toBe(false);
  });

  it('should throw on require with insufficient permission', () => {
    mockStore['_test_role'] = 'worker';
    expect(() => rbacStore.require('finance.view')).toThrow('không có quyền');
  });

  it('should not throw on require with sufficient permission', () => {
    mockStore['_test_role'] = 'owner';
    expect(() => rbacStore.require('finance.view')).not.toThrow();
  });

  it('should default to owner role when not set', async () => {
    const role = rbacStore.getRole();
    expect(role).toBe('owner');
  });

  it('should persist role between sessions', async () => {
    await rbacStore.setRole('manager');
    const loaded = await rbacStore.loadRole();
    expect(loaded).toBe('manager');
  });
});
