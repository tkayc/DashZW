/**
 * Maps platform configuration (PART 5).
 * API keys are read from environment variables — never hardcoded.
 *
 * TODO(Google Maps): Enable when GOOGLE_MAPS_API_KEY is set:
 *   - Maps JavaScript SDK (frontends)
 *   - Places API (address autocomplete)
 *   - Directions API (turn-by-turn polylines)
 *   - Geocoding API (forward/reverse geocode)
 *   - Distance Matrix API (road distance + ETA)
 */

export function getMapsConfig() {
  const googleKey = process.env.GOOGLE_MAPS_API_KEY || '';
  const osrmUrl = process.env.OSRM_URL || 'https://router.project-osrm.org';

  return {
    provider: googleKey ? 'google' : 'openstreetmap',
    google: {
      apiKey: googleKey || null,
      mapsSdk: !!googleKey,
      placesApi: process.env.GOOGLE_PLACES_ENABLED === '1' && !!googleKey,
      directionsApi: process.env.GOOGLE_DIRECTIONS_ENABLED === '1' && !!googleKey,
      geocodingApi: process.env.GOOGLE_GEOCODING_ENABLED === '1' && !!googleKey,
      distanceMatrixApi: process.env.GOOGLE_DISTANCE_MATRIX_ENABLED === '1' && !!googleKey,
    },
    openstreetmap: {
      tileUrl: process.env.OSM_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      geocodeUrl: process.env.OSM_GEOCODE_URL || 'https://nominatim.openstreetmap.org',
      userAgent: process.env.OSM_USER_AGENT || 'DashZW-Platform/1.0',
    },
    osrm: {
      baseUrl: osrmUrl,
    },
    defaults: {
      country: process.env.DEFAULT_COUNTRY || 'South Africa',
      city: process.env.DEFAULT_CITY || 'Johannesburg',
    },
  };
}
