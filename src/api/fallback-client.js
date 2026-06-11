// fallback-client — auto LAN→Cloud, retry, JWT refresh
import { authStore } from '../stores/auth.js';

const TIMEOUT_MS = 5000; // LAN timeout before fallback to cloud

function withTimeout(promise, ms) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('timeout')), ms);
    promise.then(v => { clearTimeout(t); res(v); })
           .catch(e => { clearTimeout(t); rej(e); });
  });
}

async function rawFetch(baseUrl, path, opts = {}) {
  const url = baseUrl.replace(/\/$/, '') + path;
  const headers = {
    'Content-Type': 'application/json',
    ...authStore.authHeader(),
    ...(opts.headers || {})
  };
  return withTimeout(fetch(url, { ...opts, headers }), TIMEOUT_MS);
}

/**
 * fallbackFetch — try LAN first, on fail/timeout try Cloud (GAS).
 * GAS uses action-based POST; we translate path → action for read calls.
 */
export async function fallbackFetch(path, opts = {}) {
  const mode = authStore.mode || 'lan';

  // Pure cloud
  if (mode === 'cloud' && authStore.cloudUrl) {
    return cloudFetch(path, opts);
  }

  // LAN first
  try {
    const r = await rawFetch(authStore.url, path, opts);
    if (r.status === 401 && authStore.refresh) {
      // try refresh once
      try {
        await authStore.refreshToken();
        return await rawFetch(authStore.url, path, opts);
      } catch (_) {
        // fall through
      }
    }
    return r;
  } catch (err) {
    if (mode === 'auto' && authStore.cloudUrl) {
      console.warn('[fallback] LAN fail, trying cloud:', err.message);
      return cloudFetch(path, opts);
    }
    throw err;
  }
}

// GAS cloud — POST action-based
async function cloudFetch(path, opts = {}) {
  if (!authStore.cloudUrl) throw new Error('Chưa cấu hình Cloud URL');
  const method = (opts.method || 'GET').toUpperCase();
  let action = 'hybrid_pull';
  let payload = {};
  if (path.startsWith('/api/sensors')) action = 'hybrid_pull';
  if (path.startsWith('/api/alerts')) action = 'hybrid_pull';
  if (method === 'POST' || method === 'PATCH') action = 'hybrid_push';

  if (opts.body) {
    try { payload = JSON.parse(opts.body); } catch (_) {}
  }
  const body = JSON.stringify({
    action,
    path,
    method,
    payload,
    token: authStore.token,
    farmerId: authStore.farmerId
  });
  return withTimeout(fetch(authStore.cloudUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' }, // GAS-friendly
    body
  }), TIMEOUT_MS * 2);
}
