import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api';

/**
 * useDriverLocation(orderId, shouldBroadcast)
 *
 * When shouldBroadcast=true (driver side):
 *   - Watches the browser's geolocation
 *   - Persists lat/lng to the Order record every ~10 s
 *   - Returns the current [lat, lng] position
 *
 * When shouldBroadcast=false (customer side):
 *   - Just returns null (position comes from the order data directly)
 */
export function useDriverLocation(orderId, shouldBroadcast = false) {
  const [position, setPosition] = useState(null);
  const intervalRef = useRef(null);
  const watchRef = useRef(null);
  const latestPos = useRef(null);

  useEffect(() => {
    if (!shouldBroadcast || !orderId) return;

    // Guard: browser geolocation must be available
    if (!navigator.geolocation) {
      console.warn('useDriverLocation: geolocation not supported');
      return;
    }

    // Watch position continuously
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = [pos.coords.latitude, pos.coords.longitude];
        latestPos.current = coords;
        setPosition(coords);
      },
      (err) => {
        console.warn('useDriverLocation: geolocation error', err.message);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    // Periodically push the latest position to the backend
    intervalRef.current = setInterval(async () => {
      if (!latestPos.current) return;
      const [lat, lng] = latestPos.current;
      try {
        await base44.entities.Order.update(orderId, {
          driver_lat: lat,
          driver_lng: lng,
        });
      } catch (err) {
        console.warn('useDriverLocation: failed to update order location', err);
      }
    }, 10_000); // every 10 seconds

    return () => {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [orderId, shouldBroadcast]);

  return position;
}
