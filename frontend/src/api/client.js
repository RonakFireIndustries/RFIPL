const BASE_URL = '/api';

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