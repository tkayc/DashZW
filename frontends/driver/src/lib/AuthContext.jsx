import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44, cacheUser, getToken, setToken, preloadCollections } from '@/api';
import { markSplashPending } from '@shared/hooks/useAppSplash';

const AuthContext = createContext();
const REQUIRED_ROLE = 'driver';

const PRELOAD_CRITICAL = ['Wallet', 'Notification', 'DriverProfile'];
const PRELOAD_BACKGROUND = ['Order', 'Transaction'];

function warmCaches() {
  void safePreload(PRELOAD_CRITICAL, 50);
  void safePreload(PRELOAD_BACKGROUND, 40);
}

async function safePreload(keys, limit) {
  try {
    await preloadCollections(keys, limit);
  } catch (e) {
    console.warn('[DashZW] preload failed', e);
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuth] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    (async () => {
      if (!getToken()) {
        setIsLoadingAuth(false);
        return;
      }
      try {
        const u = await base44.auth.me();
        if (u.role !== REQUIRED_ROLE) {
          setToken(null);
          cacheUser(null);
          setIsLoadingAuth(false);
          return;
        }
        cacheUser(u);
        setUser(u);
        setIsAuth(true);
        warmCaches();
      } catch {
        setToken(null);
        cacheUser(null);
      }
      setIsLoadingAuth(false);
    })();
  }, []);

  const login = async (email, password) => {
    const u = await base44.auth.login(email, password);
    if (u.role !== REQUIRED_ROLE) {
      setToken(null);
      cacheUser(null);
      throw new Error('This account is not a driver. Use the driver app.');
    }
    cacheUser(u);
    setUser(u);
    setIsAuth(true);
    markSplashPending('driver');
    warmCaches();
    return u;
  };

  const register = async (payload) => {
    const { registerDriver } = await import('@/api');
    const result = await registerDriver(payload);
    return result;
  };

  const logout = () => {
    setUser(null);
    setIsAuth(false);
    cacheUser(null);
    setToken(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoadingAuth, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
