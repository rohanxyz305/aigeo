// Empty in development (Vite proxies /api to Spring Boot); the backend's URL in production.
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function failure(res) {
  let message = '';
  try {
    const text = await res.text();
    try {
      message = JSON.parse(text).error || '';
    } catch {
      message = text.slice(0, 300);
    }
  } catch {}
  // A rejected token comes back as a bare 401 with no body.
  if (!message) message = res.status === 401 ? 'Your session has expired. Sign in again.' : `Request failed (${res.status})`;
  const err = new Error(message);
  err.status = res.status;
  return err;
}

async function request(path, { method = 'GET', body, token } = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Could not reach the server. Check that the backend is running.');
  }
  if (!res.ok) throw await failure(res);
  return res;
}

export const signup = (form) => request('/api/auth/signup', { method: 'POST', body: form }).then((r) => r.json());
export const login = (form) => request('/api/auth/login', { method: 'POST', body: form }).then((r) => r.json());

export const discover = (token, site) =>
  request(`/api/discover?site=${encodeURIComponent(site)}`, { token }).then((r) => r.json());

export const inspectPage = (token, site, url) =>
  request(`/api/page?site=${encodeURIComponent(site)}&url=${encodeURIComponent(url)}`, { token }).then((r) => r.json());

/** Streams one platform's report, calling onText with the full text so far after every chunk. */
export async function analyze(token, platform, data, onText) {
  const res = await request('/api/analyze', { method: 'POST', body: { platform, data }, token });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    onText(text);
  }
  if (!text.trim()) throw new Error('The model returned an empty answer');
  return text;
}
