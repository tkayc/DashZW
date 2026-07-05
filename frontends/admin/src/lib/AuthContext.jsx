import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44, cacheUser, getToken, setToken, preloadCollections } from '@/api';
import { markSplashPending } from '@shared/hooks/useAppSplash';

const AuthContext = createContext();
const REQUIRED_ROLE = 'admin';

function isAdminRole(role) {
  return role === 'admin' || role === 'super_admin';
}

async function safePreload(keys, limit = 80) {
  try {
    await preloadCollections(keys, limit);
  } catch (e) {
    console.warn('[DashZW] preload failed', e);
  }
}

function warmCaches() {
  void safePreload(['Order', 'Wallet', 'Transaction', 'Notification', 'Shop', 'Settlement', 'AdminPromotion'], 60);
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
        if (!isAdminRole(u.role)) {
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
    if (!isAdminRole(u.role)) {
      setToken(null);
      cacheUser(null);
      throw new Error('This account is not a manager. Use the admin dashboard.');
    }
    cacheUser(u);
    setUser(u);
    setIsAuth(true);
    markSplashPending('admin');
    warmCaches();
    return u;
  };

  const logout = () => {
    setUser(null);
    setIsAuth(false);
    cacheUser(null);
    setToken(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoadingAuth, login, register: null, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
