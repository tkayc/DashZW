/**
 * Shared location API client — calls /api/location/* on the backend.
 */
export function createLocationApi({ getApiBaseUrl, getToken }) {
  async function locationFetch(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    const token = getToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${getApiBaseUrl()}${path}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || res.statusText);
    return data;
  }

  return {
    getConfig: () => locationFetch('/api/location/config'),
    geocode: (address, opts = {}) =>
      locationFetch('/api/location/geocode', { method: 'POST', body: JSON.stringify({ address, ...opts }) }),
    reverseGeocode: (lat, lng) =>
      locationFetch('/api/location/reverse-geocode', { method: 'POST', body: JSON.stringify({ lat, lng }) }),
    searchPlaces: (q, opts = {}) => {
      const params = new URLSearchParams({ q, ...opts });
      return locationFetch(`/api/location/places/search?${params}`);
    },
    quoteDelivery: (body) =>
      locationFetch('/api/location/quote', { method: 'POST', body: JSON.stringify(body) }),
    quoteCourier: (body) =>
      locationFetch('/api/location/courier/quote', { method: 'POST', body: JSON.stringify(body) }),
    listAddresses: () => locationFetch('/api/location/addresses'),
    getDefaultAddress: () => locationFetch('/api/location/addresses/default'),
    createAddress: (data) =>
      locationFetch('/api/location/addresses', { method: 'POST', body: JSON.stringify(data) }),
    updateAddress: (id, data) =>
      locationFetch(`/api/location/addresses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteAddress: (id) =>
      locationFetch(`/api/location/addresses/${id}`, { method: 'DELETE' }),
    setDefaultAddress: (id) =>
      locationFetch(`/api/location/addresses/${id}/default`, { method: 'POST' }),
    saveCurrentLocation: (lat, lng, data = {}) =>
      locationFetch('/api/location/addresses/current-location', {
        method: 'POST',
        body: JSON.stringify({ lat, lng, ...data }),
      }),
    discoverMerchants: ({ lat, lng, sort = 'nearest', limit = 50, category } = {}) => {
      const params = new URLSearchParams({ sort, limit: String(limit) });
      if (lat != null) params.set('lat', String(lat));
      if (lng != null) params.set('lng', String(lng));
      if (category) params.set('category', category);
      return locationFetch(`/api/location/merchants/discover?${params}`);
    },
    getMerchantQuote: (merchantId, lat, lng) =>
      locationFetch(`/api/location/merchants/${merchantId}/quote?lat=${lat}&lng=${lng}`),
    updateDriverLocation: (payload) =>
      locationFetch('/api/location/drivers/me/location', { method: 'POST', body: JSON.stringify(payload) }),
    getOrderTracking: (orderId) => locationFetch(`/api/location/orders/${orderId}/tracking`),
    calculateOrderRoute: (orderId, origin, destination, route_type) =>
      locationFetch(`/api/location/orders/${orderId}/route`, {
        method: 'POST',
        body: JSON.stringify({ origin, destination, route_type }),
      }),
    getNavigationUrl: (destLat, destLng, provider = 'google') =>
      locationFetch(`/api/location/navigation/url?dest_lat=${destLat}&dest_lng=${destLng}&provider=${provider}`),
    getLiveOps: (filters = {}) => {
      const params = new URLSearchParams(filters);
      return locationFetch(`/api/location/live-ops?${params}`);
    },
    getDemandZones: ({ lat, lng, radius_km } = {}) => {
      const params = new URLSearchParams();
      if (lat != null) params.set('lat', String(lat));
      if (lng != null) params.set('lng', String(lng));
      if (radius_km != null) params.set('radius_km', String(radius_km));
      const qs = params.toString();
      return locationFetch(`/api/location/drivers/demand-zones${qs ? `?${qs}` : ''}`);
    },
  };
}
