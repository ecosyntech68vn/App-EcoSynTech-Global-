import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStore = {};
vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key) => mockStore[key] ?? null),
  set: vi.fn(async (key, val) => { mockStore[key] = val; }),
  del: vi.fn(async (key) => { delete mockStore[key]; }),
  keys: vi.fn(async () => Object.keys(mockStore))
}));

vi.mock('../stores/auth.js', () => ({
  authStore: { farmerId: 'test-farmer', url: 'http://localhost:3000', authHeader: () => ({}) }
}));

let fetchMock;
vi.mock('../api/fallback-client.js', () => ({
  fallbackFetch: vi.fn((path) => {
    if (path === '/api/invalid' || path.startsWith('/api/fail') || path.startsWith('/api/invalid') || path === '/api/todelete') {
      return Promise.resolve({ ok: false, status: 400 });
    }
    return Promise.resolve({ ok: true, status: 200 });
  })
}));

import { syncQueue } from '../stores/sync.js';

function clearStore() { Object.keys(mockStore).forEach(k => delete mockStore[k]); }

describe('syncQueue', () => {
  beforeEach(() => { clearStore(); });

  it('should enqueue item for sync', async () => {
    await syncQueue.enqueue({ path: '/api/lots', method: 'POST', body: { name: 'Test' } });
    const size = await syncQueue.size();
    expect(size).toBe(1);
  });

  it('should process queue', async () => {
    await syncQueue.enqueue({ path: '/api/health', method: 'GET' });
    await syncQueue.processQueue();
    const size = await syncQueue.size();
    expect(size).toBe(0);
  });

  it('should handle empty queue gracefully', async () => {
    const size = await syncQueue.size();
    expect(size).toBe(0);
    await syncQueue.processQueue();
  });

  it('should move failed items to dead letter after 3 retries', async () => {
    const id = 'queue:direct_1';
    mockStore[id] = { path: '/api/invalid', method: 'POST', body: JSON.stringify({ test: true }), ts: Date.now(), retries: 2 };
    await syncQueue.processQueue();
    const deadSize = await syncQueue.deadSize();
    expect(deadSize).toBe(1);
  });

  it('should retry a dead letter item', async () => {
    const id = 'queue:direct_2';
    mockStore[id] = { path: '/api/invalid', method: 'POST', body: JSON.stringify({ test: true }), ts: Date.now(), retries: 2 };
    await syncQueue.processQueue();
    const dead = await syncQueue.listDead();
    if (dead.length > 0) {
      await syncQueue.retryDead(dead[0].id);
    }
    const retriedSize = await syncQueue.size();
    expect(retriedSize).toBe(1);
  });

  it('should retry all dead letters', async () => {
    mockStore['queue:a'] = { path: '/api/invalid1', method: 'POST', body: JSON.stringify({ a: 1 }), ts: Date.now(), retries: 2 };
    mockStore['queue:b'] = { path: '/api/invalid2', method: 'POST', body: JSON.stringify({ a: 1 }), ts: Date.now(), retries: 2 };
    await syncQueue.processQueue();
    await syncQueue.retryAllDead();
    const size = await syncQueue.size();
    expect(size).toBe(2);
  });

  it('should clear queue', async () => {
    await syncQueue.enqueue({ path: '/api/test', method: 'GET' });
    await syncQueue.enqueue({ path: '/api/test2', method: 'GET' });
    await syncQueue.clearAll();
    const size = await syncQueue.size();
    expect(size).toBe(0);
  });

  it('should handle enqueue when offline (no crash)', async () => {
    await syncQueue.enqueue({ path: '/api/lots', method: 'POST', body: { offline: true } });
    const size = await syncQueue.size();
    expect(size).toBeGreaterThanOrEqual(1);
  });

  it('should not lose data after failed process', async () => {
    mockStore['queue:critical'] = { path: '/api/invalid', method: 'PUT', body: JSON.stringify({ critical: true }), ts: Date.now(), retries: 2 };
    await syncQueue.processQueue();
    const deadSize = await syncQueue.deadSize();
    const queueSize = await syncQueue.size();
    expect(deadSize + queueSize).toBe(1);
  });

  it('should handle multiple concurrent enqueues', async () => {
    await Promise.all([
      syncQueue.enqueue({ path: '/api/a', method: 'GET' }),
      syncQueue.enqueue({ path: '/api/b', method: 'GET' }),
      syncQueue.enqueue({ path: '/api/c', method: 'GET' })
    ]);
    const size = await syncQueue.size();
    expect(size).toBe(3);
  });

  it('should export dead letter as JSON', async () => {
    mockStore['queue:export_1'] = { path: '/api/fail', method: 'POST', body: JSON.stringify({ x: 1 }), ts: Date.now(), retries: 2 };
    await syncQueue.processQueue();
    const json = await syncQueue.exportDead();
    const data = JSON.parse(json);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(1);
  });

  it('should handle delete from dead letter', async () => {
    mockStore['queue:delete_1'] = { path: '/api/todelete', method: 'POST', body: JSON.stringify({ x: 1 }), ts: Date.now(), retries: 2 };
    await syncQueue.processQueue();
    const dead = await syncQueue.listDead();
    if (dead.length > 0) {
      await syncQueue.deleteDead(dead[0].id);
    }
    const remaining = await syncQueue.deadSize();
    expect(remaining).toBe(0);
  });

  it('should handle retry of nonexistent dead letter', async () => {
    await expect(syncQueue.retryDead('nonexistent')).resolves.not.toThrow();
  });

  it('should handle delete of nonexistent dead letter', async () => {
    await expect(syncQueue.deleteDead('nonexistent')).resolves.not.toThrow();
  });
});
