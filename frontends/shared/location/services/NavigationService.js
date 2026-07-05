export function createNavigationService(locationApi) {
  return {
    getRoute: (orderId, origin, destination, route_type) =>
      locationApi.calculateOrderRoute(orderId, origin, destination, route_type),
    openExternal: async (destLat, destLng, provider = 'google') => {
      const { url } = await locationApi.getNavigationUrl(destLat, destLng, provider);
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    // TODO(Voice Navigation): Web Speech API / native bridge placeholder
    voiceNavigationPlaceholder: () => {
      console.info('[NavigationService] Voice navigation — integrate with Google Maps SDK or native app');
    },
    // TODO(Traffic): Google Directions traffic_model when enabled
    trafficPlaceholder: () => null,
  };
}
