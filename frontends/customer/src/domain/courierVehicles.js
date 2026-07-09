/**
 * Courier vehicle types — mirrors backend courierVehicles.js
 */
import { COURIER_VEHICLE_ICON_SRC } from '@assets/icons/index.js';

export const COURIER_VEHICLES = [
  {
    id: 'motorbike',
    label: 'Motorbike',
    description: 'Documents & small parcels',
    iconSrc: COURIER_VEHICLE_ICON_SRC.motorbike,
  },
  {
    id: 'car',
    label: 'Car',
    description: 'Medium boxes & fragile items',
    iconSrc: COURIER_VEHICLE_ICON_SRC.car,
  },
  {
    id: 'van',
    label: 'Van',
    description: 'Large packages & bulky goods',
    iconSrc: COURIER_VEHICLE_ICON_SRC.van,
  },
];

export function getCourierVehicle(id) {
  return COURIER_VEHICLES.find((v) => v.id === id) || COURIER_VEHICLES[0];
}
