import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../api.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    api('/auth/me')
      .then(d => setUser(d.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const { user, token } = await api('/auth/login', { method: 'POST', body: { email, password } });
    setToken(token);
    setUser(user);
  }
  function logout() { setToken(null); setUser(null); }

  // Permission check mirrors the server: owners hold everything.
  const can = (key) => !!user && (user.is_owner || (user.permissions || []).includes(key));

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout, can }}>
      {children}
    </AuthCtx.Provider>
  );
}
