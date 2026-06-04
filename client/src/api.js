// Thin fetch wrapper. Attaches the JWT and parses JSON.
const TOKEN_KEY = 'psp_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 401) { setToken(null); window.location.reload(); return; }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) throw Object.assign(new Error(data?.error || 'Request failed'), { data, status: res.status });
  return data;
}

// ZAR formatter. `null` (gated by the server) renders as an em dash.
export function rand(n) {
  if (n === null || n === undefined) return '—';
  return 'R\u00a0' + Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
