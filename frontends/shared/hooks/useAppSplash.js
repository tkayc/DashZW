import { useState, useCallback, useEffect } from 'react';

export function splashStorageKey(appId) {
  return `dashzw_splash_seen_${appId}`;
}

/** Call after login so the splash plays when entering the app. */
export function markSplashPending(appId) {
  sessionStorage.removeItem(splashStorageKey(appId));
}

export function useAppSplash(appId, enabled = true) {
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setShowSplash(false);
      return;
    }
    setShowSplash(!sessionStorage.getItem(splashStorageKey(appId)));
  }, [appId, enabled]);

  const dismissSplash = useCallback(() => {
    sessionStorage.setItem(splashStorageKey(appId), '1');
    setShowSplash(false);
  }, [appId]);

  return { showSplash, dismissSplash };
}
