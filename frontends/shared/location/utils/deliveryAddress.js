/** Human-readable delivery line from LocationContext / saved address records */
export function formatDeliveryLine(delivery) {
  if (!delivery) return '';
  if (delivery.formatted_address?.trim()) return delivery.formatted_address.trim();
  if (delivery.street_address?.trim()) {
    return [delivery.street_address, delivery.suburb, delivery.city].filter(Boolean).join(', ');
  }
  if (delivery.lat != null && delivery.lng != null) {
    return `📍 ${Number(delivery.lat).toFixed(4)}, ${Number(delivery.lng).toFixed(4)}`;
  }
  return '';
}

export function deliveryHasCoords(delivery) {
  return delivery?.lat != null && delivery?.lng != null;
}
