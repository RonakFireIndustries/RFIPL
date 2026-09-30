import { createContext, useState, useEffect, useCallback } from 'react';
import { loginUser, registerUser, getMe, refreshToken, logoutUser } from '@/api/auth';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('accessToken'));
  const [refreshTokenValue, setRefreshTokenValue] = useState(() => localStorage.getItem('refreshToken'));
  const [loading, setLoading] = useState(true);

  const persistTokens = useCallback((access, refresh) => {
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
    setAccessToken(access);
    setRefreshTokenValue(refresh);
  }, []);

  const clearTokens = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setAccessToken(null);
    setRefreshTokenValue(null);
  }, []);

  const handleRefresh = useCallback(async () => {
    if (!refreshTokenValue) {
      setLoading(false);
      return;
    }
    try {
      const data = await refreshToken(refreshTokenValue);
      persistTokens(data.accessToken, data.refreshToken);
      const profile = await getMe(data.accessToken);
      setUser(profile);
    } catch {
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [refreshTokenValue, persistTokens, clearTokens]);

  useEffect(() => {
    if (accessToken) {
      getMe(accessToken)
        .then((profile) => {
          setUser(profile);
          setLoading(false);
        })
        .catch(() => {
          handleRefresh();
        });
    } else {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (email, password) => {
    const data = await loginUser(email, password);
    persistTokens(data.accessToken, data.refreshToken);
    const profile = await getMe(data.accessToken);
    setUser(profile);
    return data;
  };

  const register = async (email, password) => {
    const data = await registerUser(email, password);
    persistTokens(data.accessToken, data.refreshToken);
    const profile = await getMe(data.accessToken);
    setUser(profile);
    return data;
  };

  const logout = async () => {
    try {
      if (refreshTokenValue) await logoutUser(refreshTokenValue);
    } catch {
      // ignore logout errors
    }
    clearTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}