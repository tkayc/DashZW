/**
 * Courier vehicle types — used for pricing and driver availability matching.
 */
export const COURIER_VEHICLES = [
  {
    id: 'motorbike',
    label: 'Motorbike',
    description: 'Documents & small parcels',
    emoji: '🏍️',
    fee_multiplier: 1,
    search_radius_km: 6,
    eta_buffer_mins: 0,
  },
  {
    id: 'car',
    label: 'Car',
    description: 'Medium boxes & fragile items',
    emoji: '🚗',
    fee_multiplier: 1.45,
    search_radius_km: 10,
    eta_buffer_mins: 5,
  },
  {
    id: 'van',
    label: 'Van',
    description: 'Large packages & bulky goods',
    emoji: '🚐',
    fee_multiplier: 2.1,
    search_radius_km: 14,
    eta_buffer_mins: 10,
  },
];

export const COURIER_VEHICLE_IDS = COURIER_VEHICLES.map((v) => v.id);

export function getCourierVehicle(id) {
  return COURIER_VEHICLES.find((v) => v.id === id) || COURIER_VEHICLES[0];
}

export function normalizeCourierVehicle(value) {
  const key = String(value || '').trim().toLowerCase();
  if (key === 'bike' || key === 'motorcycle' || key === 'scooter') return 'motorbike';
  if (COURIER_VEHICLE_IDS.includes(key)) return key;
  return null;
}

/**
 * Matching rules:
 * - Exact match always OK
 * - Motorbike jobs can also be taken by car drivers
 * - Van jobs only by van; car jobs only by car
 */
export function canDriverFulfillVehicle(driverVehicle, requiredVehicle) {
  const driver = normalizeCourierVehicle(driverVehicle);
  const required = normalizeCourierVehicle(requiredVehicle);
  if (!driver || !required) return false;
  if (driver === required) return true;
  if (required === 'motorbike' && driver === 'car') return true;
  return false;
}
