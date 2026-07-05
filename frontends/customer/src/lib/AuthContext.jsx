import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { base44, cacheUser, getToken, setToken, preloadCollections } from '@/api';
import { ROLES, normalizeRole } from '@/domain/roles';
import { PERMISSIONS, requirePermission } from '@/domain/permissions';
import { markSplashPending } from '@shared/hooks/useAppSplash';

const AuthContext = createContext();
const REQUIRED_ROLE = ROLES.CUSTOMER;
const REMEMBER_KEY = 'dashzw_remember_me';
const GUEST_KEY = 'dashzw_guest_mode';

const PRELOAD_CRITICAL = ['Shop', 'Wallet', 'Notification'];
const PRELOAD_BACKGROUND = ['Order', 'Transaction', 'MenuItem', 'Promotion', 'Branch'];

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
  const [isGuest, setIsGuest] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [emailVerified, setEmailVerified] = useState(false);

  useEffect(() => {
    (async () => {
      const guest = localStorage.getItem(GUEST_KEY) === '1';
      if (guest && !getToken()) {
        setIsGuest(true);
        setIsLoadingAuth(false);
        return;
      }

      if (!getToken()) {
        setIsLoadingAuth(false);
        return;
      }
      try {
        const u = await base44.auth.me();
        const role = normalizeRole(u.role);
        if (role !== REQUIRED_ROLE && u.role !== 'customer') {
          setToken(null);
          cacheUser(null);
          setIsLoadingAuth(false);
          return;
        }
        cacheUser(u);
        setUser(u);
        setIsAuth(true);
        setIsGuest(false);
        setEmailVerified(!!u.email_verified);
        localStorage.removeItem(GUEST_KEY);
        warmCaches();
      } catch {
        setToken(null);
        cacheUser(null);
      }
      setIsLoadingAuth(false);
    })();
  }, []);

  const login = async (email, password, { rememberMe = true } = {}) => {
    const u = await base44.auth.login(email, password);
    const role = normalizeRole(u.role);
    if (role !== REQUIRED_ROLE && u.role !== 'customer') {
      setToken(null);
      cacheUser(null);
      throw new Error('This account is not a customer. Use the correct portal.');
    }
    if (!rememberMe) {
      // Session-only: clear token on tab close is browser-limited; flag for future
      localStorage.setItem(REMEMBER_KEY, '0');
    } else {
      localStorage.setItem(REMEMBER_KEY, '1');
    }
    cacheUser(u);
    setUser(u);
    setIsAuth(true);
    setIsGuest(false);
    setEmailVerified(!!u.email_verified);
    localStorage.removeItem(GUEST_KEY);
    markSplashPending('customer');
    warmCaches();
    return u;
  };

  const register = async (data) => {
    const u = await base44.auth.register({ ...data, role: 'customer' });
    cacheUser(u);
    setUser(u);
    setIsAuth(true);
    setIsGuest(false);
    setEmailVerified(false);
    localStorage.removeItem(GUEST_KEY);
    markSplashPending('customer');
    warmCaches();
    return u;
  };

  const enterGuestMode = useCallback(() => {
    setToken(null);
    cacheUser(null);
    setUser(null);
    setIsAuth(false);
    setIsGuest(true);
    localStorage.setItem(GUEST_KEY, '1');
    markSplashPending('customer');
  }, []);

  const logout = () => {
    setUser(null);
    setIsAuth(false);
    setIsGuest(false);
    cacheUser(null);
    setToken(null);
    localStorage.removeItem(GUEST_KEY);
    window.location.href = '/login';
  };

  const hasPermission = useCallback(
    (permission) => {
      if (isGuest) return requirePermission({ role: ROLES.GUEST }, permission);
      return requirePermission(user, permission);
    },
    [user, isGuest]
  );

  /** Placeholder social / biometric login */
  const loginWithProvider = async (provider) => {
    // TODO(auth): OAuth / WebAuthn integration
    throw new Error(`${provider} login is not connected yet`);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isGuest,
        isLoadingAuth,
        emailVerified,
        login,
        register,
        logout,
        enterGuestMode,
        hasPermission,
        loginWithProvider,
        PERMISSIONS,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
