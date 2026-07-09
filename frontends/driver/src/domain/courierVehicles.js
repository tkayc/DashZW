/**
 * Courier vehicle helpers for the driver app.
 */
export const COURIER_VEHICLES = [
  { id: 'motorbike', label: 'Motorbike', description: 'Documents & small parcels' },
  { id: 'car', label: 'Car', description: 'Medium boxes & fragile items' },
  { id: 'van', label: 'Van', description: 'Large packages & bulky goods' },
];

export function normalizeCourierVehicle(value) {
  const key = String(value || '').trim().toLowerCase();
  if (key === 'bike' || key === 'motorcycle' || key === 'scooter') return 'motorbike';
  if (['motorbike', 'car', 'van'].includes(key)) return key;
  return null;
}

/** Bike jobs visible to bike + car; car/van only exact match. */
export function canDriverFulfillVehicle(driverVehicle, requiredVehicle) {
  const driver = normalizeCourierVehicle(driverVehicle);
  const required = normalizeCourierVehicle(requiredVehicle);
  if (!driver || !required) return false;
  if (driver === required) return true;
  if (required === 'motorbike' && driver === 'car') return true;
  return false;
}
