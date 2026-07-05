import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api';
import { createLocationApi } from '@location/api/locationApi.js';
import { getApiBaseUrl, getToken } from '@/api/client.js';

const locationApi = createLocationApi({ getApiBaseUrl, getToken });

/**
 * Broadcasts driver GPS to backend location service + order record.
 */
export function useDriverLocation(orderId, shouldBroadcast = false) {
  const [position, setPosition] = useState(null);
  const intervalRef = useRef(null);
  const watchRef = useRef(null);
  const latestPos = useRef(null);

  useEffect(() => {
    if (!shouldBroadcast || !orderId) return;
    if (!navigator.geolocation) return;

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        latestPos.current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speed_kmh: pos.coords.speed != null ? pos.coords.speed * 3.6 : null,
          heading: pos.coords.heading,
          accuracy_m: pos.coords.accuracy,
        };
        setPosition([latestPos.current.lat, latestPos.current.lng]);
      },
      (err) => console.warn('useDriverLocation:', err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    intervalRef.current = setInterval(async () => {
      if (!latestPos.current) return;
      const { lat, lng, speed_kmh, heading, accuracy_m } = latestPos.current;
      try {
        await locationApi.updateDriverLocation({ lat, lng, order_id: orderId, speed_kmh, heading, accuracy_m });
        await base44.entities.Order.update(orderId, { driver_lat: lat, driver_lng: lng });
      } catch (err) {
        console.warn('useDriverLocation: update failed', err.message);
      }
    }, 8000);

    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [orderId, shouldBroadcast]);

  return position;
}
