export function createGeocodingService(locationApi) {
  return {
    geocode: (address, opts) => locationApi.geocode(address, opts),
    reverseGeocode: (lat, lng) => locationApi.reverseGeocode(lat, lng),
    search: (q, opts) => locationApi.searchPlaces(q, opts),
  };
}
