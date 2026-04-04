const TOKEN_KEY = 'citywalk_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleRes<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    removeToken();
    window.location.reload();
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error ?? 'Request failed');
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get<T>(url: string): Promise<T> {
    return fetch(url, { headers: { ...authHeaders() } }).then(r => handleRes<T>(r));
  },

  post<T>(url: string, body: unknown): Promise<T> {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
    }).then(r => handleRes<T>(r));
  },

  put<T>(url: string, body: unknown): Promise<T> {
    return fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
    }).then(r => handleRes<T>(r));
  },

  del(url: string): Promise<void> {
    return fetch(url, { method: 'DELETE', headers: { ...authHeaders() } }).then(r => handleRes<void>(r));
  },
};
