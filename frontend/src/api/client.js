// VITE_API_URL may be set to either the bare backend origin
// (e.g. https://rfipl-backend.vercel.app) or the full API path
// (e.g. https://rfipl-backend.vercel.app/api). Normalize so the
// request always ends up at <origin>/api.
const RAW_API_URL = import.meta.env.VITE_API_URL || '/api';
const BASE_URL = RAW_API_URL.replace(/\/+$/, '').endsWith('/api')
  ? RAW_API_URL.replace(/\/+$/, '')
  : `${RAW_API_URL.replace(/\/+$/, '')}/api`;

function normalizeKeys(value) {
  if (Array.isArray(value)) return value.map(normalizeKeys);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, v] of Object.entries(value)) {
      out[/[a-z]/.test(key) ? key : key.toLowerCase()] = normalizeKeys(v);
    }
    return out;
  }
  return value;
}

async function apiClient(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, options);
  const data = normalizeKeys(await res.json().catch(() => null));

  if (!res.ok) {
    const error = new Error(data?.message || `Request failed with status ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

export default apiClient;