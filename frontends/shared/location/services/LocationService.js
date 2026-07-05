/**
 * LocationService — customer delivery location orchestration (PART 1).
 */
import { getCurrentPosition, queryPermission, PERMISSION_STATE } from './PermissionService.js';

export function createLocationService(locationApi) {
  return {
    async detectAndSetDeliveryLocation({ saveAsDefault = true } = {}) {
      const permission = await queryPermission();
      if (permission === PERMISSION_STATE.DENIED) {
        return { ok: false, reason: 'denied', permission };
      }

      try {
        const coords = await getCurrentPosition();
        const geo = await locationApi.reverseGeocode(coords.lat, coords.lng);
        const delivery = {
          lat: coords.lat,
          lng: coords.lng,
          formatted_address: geo?.formatted_address || `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`,
          street_address: geo?.street_address,
          suburb: geo?.suburb,
          city: geo?.city,
          province: geo?.province,
          country: geo?.country,
          postal_code: geo?.postal_code,
          source: 'gps',
        };

        if (saveAsDefault) {
          try {
            const saved = await locationApi.saveCurrentLocation(coords.lat, coords.lng, {
              address_name: 'Current Location',
              recipient_name: '',
            });
            delivery.address_id = saved.id;
          } catch {
            /* guest or save failed — still use coords */
          }
        }

        return { ok: true, delivery, permission: PERMISSION_STATE.GRANTED };
      } catch (e) {
        return { ok: false, reason: e.message, permission };
      }
    },

    async loadDefaultDelivery() {
      try {
        const addr = await locationApi.getDefaultAddress();
        if (!addr) return null;
        return {
          address_id: addr.id,
          lat: addr.lat,
          lng: addr.lng,
          formatted_address: addr.formatted_address,
          street_address: addr.street_address,
          suburb: addr.suburb,
          city: addr.city,
          delivery_instructions: addr.delivery_instructions,
          recipient_name: addr.recipient_name,
          phone_number: addr.phone_number,
          source: 'saved',
        };
      } catch {
        return null;
      }
    },
  };
}
