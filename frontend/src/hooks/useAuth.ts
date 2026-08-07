import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { User } from '../types';

/** `/auth/me` は role / isAdmin の最新値を反映したトークンを返す。あれば保持中のものと差し替える。 */
function storeMe(data: User & { token?: string }): User {
  const { token, ...userData } = data;
  if (token) localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(userData));
  return userData as User;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/auth/me')
        .then((res) => {
          setUser(storeMe(res.data));
        })
        .catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const loginWithSsoCode = useCallback(async (code: string) => {
    const res = await api.post('/auth/microsoft/exchange', { code });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const res = await api.get('/auth/me');
    const userData = storeMe(res.data);
    setUser(userData);
    return userData;
  }, []);

  const patchUser = useCallback((partial: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  }, []);

  return { user, loading, login, loginWithSsoCode, logout, refreshUser, patchUser };
}
