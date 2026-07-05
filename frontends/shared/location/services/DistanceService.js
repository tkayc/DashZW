export function createDistanceService(locationApi) {
  return {
    quote: (body) => locationApi.quoteDelivery(body),
    quoteForMerchant: (merchantId, lat, lng) => locationApi.getMerchantQuote(merchantId, lat, lng),
    discoverMerchants: (opts) => locationApi.discoverMerchants(opts),
  };
}
