/**
 * PermissionService — browser geolocation permission (PART 1 / 11).
 */
export const PERMISSION_STATE = {
  GRANTED: 'granted',
  DENIED: 'denied',
  PROMPT: 'prompt',
  UNSUPPORTED: 'unsupported',
};

export async function queryPermission() {
  if (!navigator.geolocation) return PERMISSION_STATE.UNSUPPORTED;
  if (navigator.permissions?.query) {
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' });
      return status.state;
    } catch {
      return PERMISSION_STATE.PROMPT;
    }
  }
  return PERMISSION_STATE.PROMPT;
}

export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported on this device'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => reject(new Error(err.message || 'Location unavailable')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000, ...options }
    );
  });
}

export function watchPosition(onUpdate, onError, options = {}) {
  if (!navigator.geolocation) {
    onError?.(new Error('Geolocation unsupported'));
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (pos) =>
      onUpdate({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        speed: pos.coords.speed,
        heading: pos.coords.heading,
      }),
    (err) => onError?.(new Error(err.message)),
    { enableHighAccuracy: true, maximumAge: 5000, ...options }
  );
  return () => navigator.geolocation.clearWatch(id);
}
