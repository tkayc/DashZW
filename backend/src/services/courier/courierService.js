/**
 * CourierService — point-to-point package delivery quotes and booking.
 */
import { localDb } from '../../db/localDb.js';
import { query, isPostgresEnabled } from '../../db/pg.js';
import { haversineKm, roadDistance } from '../location/distanceService.js';
import { calcDeliveryFee, calcServiceFee } from '../financial/pricingService.js';
import { placeOrder } from '../orders/orderEngine.js';
import { createNotification } from '../notifications/notifications.js';
import { ORDER_STATUS } from '../../domain/orderStates.js';
import {
  COURIER_VEHICLES,
  getCourierVehicle,
  normalizeCourierVehicle,
  canDriverFulfillVehicle,
} from '../../domain/courierVehicles.js';

const COURIER_PLATFORM_ID = 'courier_platform';

async function ensureCourierPlatformMerchant() {
  if (!isPostgresEnabled()) return;
  await query(
    `INSERT INTO merchants (
      id, name, description, category_id, address, city, phone,
      lat, lng, rating, estimated_delivery_time, is_open, opening_hours,
      owner_email, approval_status, verification_status
    ) VALUES (
      $1, 'DashZW Courier', 'Platform courier service for packages', 'other',
      'DashZW HQ', 'Johannesburg', '+27 11 000 0000',
      -26.2041, 28.0473, 5.0, '20-40 min', TRUE, '24/7',
      'admin@dashzw.com', 'approved', 'verified'
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      approval_status = 'approved',
      updated_at = NOW()`,
    [COURIER_PLATFORM_ID]
  );
}

const DEMO_DRIVERS = [
  { email: 'driver1@dashzw.com', vehicle_type: 'motorbike', lat: -26.1073, lng: 28.0570, rating: 4.9 },
  { email: 'driver2@dashzw.com', vehicle_type: 'car', lat: -26.1465, lng: 28.0427, rating: 4.7 },
  { email: 'driver3@dashzw.com', vehicle_type: 'van', lat: -26.1950, lng: 28.0410, rating: 4.8 },
];

async function listDriverProfiles(localDbRef) {
  let drivers = [];

  if (isPostgresEnabled()) {
    try {
      const r = await query(
        `SELECT email, vehicle_type, current_lat AS lat, current_lng AS lng, is_online, rating
         FROM driver_profiles
         WHERE current_lat IS NOT NULL AND current_lng IS NOT NULL`
      );
      drivers = r.rows.map((row) => ({
        email: row.email,
        vehicle_type: normalizeCourierVehicle(row.vehicle_type) || 'motorbike',
        lat: Number(row.lat),
        lng: Number(row.lng),
        is_online: row.is_online !== false,
        rating: row.rating != null ? Number(row.rating) : 5,
      }));
    } catch {
      drivers = [];
    }
  }

  if (!drivers.length && localDbRef?.entities?.DriverProfile) {
    try {
      const profiles = await localDbRef.entities.DriverProfile.list('-updated_date', 200);
      drivers = profiles
        .filter((p) => p.current_lat != null && p.current_lng != null)
        .map((p) => ({
          email: p.email,
          vehicle_type: normalizeCourierVehicle(p.vehicle_type) || 'motorbike',
          lat: Number(p.current_lat),
          lng: Number(p.current_lng),
          is_online: p.is_online !== false,
          rating: p.rating != null ? Number(p.rating) : 5,
        }));
    } catch {
      drivers = [];
    }
  }

  // Demo fallback so courier quotes work in local/dev even without GPS updates
  if (!drivers.length) {
    drivers = DEMO_DRIVERS.map((d) => ({ ...d, is_online: true }));
  }

  return drivers;
}

function countNearbyDrivers(drivers, pickupLat, pickupLng, vehicleId) {
  const vehicle = getCourierVehicle(vehicleId);
  return drivers.filter((d) => {
    if (!d.is_online) return false;
    if (!canDriverFulfillVehicle(d.vehicle_type, vehicleId)) return false;
    const dist = haversineKm(pickupLat, pickupLng, d.lat, d.lng);
    return dist <= vehicle.search_radius_km;
  });
}

function buildVehicleQuote(distanceKm, durationMins, vehicleId, nearbyDrivers, pickupLat, pickupLng) {
  const vehicle = getCourierVehicle(vehicleId);
  const baseFee = calcDeliveryFee(distanceKm);
  const deliveryFee = parseFloat((baseFee * vehicle.fee_multiplier).toFixed(2));
  const serviceFee = calcServiceFee(deliveryFee);
  const driverEarning = parseFloat(Math.max(0, deliveryFee - serviceFee).toFixed(2));
  const etaMins = (durationMins || 20) + vehicle.eta_buffer_mins;
  const sortedNearby = [...nearbyDrivers].sort((a, b) => {
    const da = haversineKm(pickupLat, pickupLng, a.lat, a.lng);
    const db = haversineKm(pickupLat, pickupLng, b.lat, b.lng);
    return da - db;
  });
  const nearest = sortedNearby[0] || null;

  return {
    id: vehicle.id,
    label: vehicle.label,
    description: vehicle.description,
    emoji: vehicle.emoji,
    available: nearbyDrivers.length > 0,
    nearby_count: nearbyDrivers.length,
    nearest_driver_km: nearest
      ? parseFloat(haversineKm(pickupLat, pickupLng, nearest.lat, nearest.lng).toFixed(2))
      : null,
    distance_km: distanceKm,
    delivery_fee: deliveryFee,
    service_fee: serviceFee,
    driver_earning: driverEarning,
    estimated_delivery_mins: etaMins,
    estimated_delivery_time: `${etaMins} min`,
    unavailable_reason:
      nearbyDrivers.length === 0
        ? `No ${vehicle.label.toLowerCase()} couriers near the pickup location right now.`
        : null,
  };
}

export async function quoteCourier({
  pickup,
  dropoff,
  vehicle_type,
  localDb: localDbRef = localDb,
} = {}) {
  if (!pickup?.lat || !pickup?.lng || !dropoff?.lat || !dropoff?.lng) {
    throw new Error('Pickup and drop-off coordinates are required');
  }

  const road = await roadDistance(
    { lat: Number(pickup.lat), lng: Number(pickup.lng) },
    { lat: Number(dropoff.lat), lng: Number(dropoff.lng) }
  );
  const distanceKm = road.distance_km;
  const durationMins = road.duration_mins;
  const drivers = await listDriverProfiles(localDbRef);

  const vehicleOptions = COURIER_VEHICLES.map((vehicle) => {
    const nearby = countNearbyDrivers(drivers, Number(pickup.lat), Number(pickup.lng), vehicle.id);
    return buildVehicleQuote(
      distanceKm,
      durationMins,
      vehicle.id,
      nearby,
      Number(pickup.lat),
      Number(pickup.lng)
    );
  });

  const selectedType = normalizeCourierVehicle(vehicle_type);
  const selected = selectedType
    ? vehicleOptions.find((v) => v.id === selectedType) || vehicleOptions[0]
    : null;

  return {
    pickup_address: pickup.address || null,
    dropoff_address: dropoff.address || null,
    distance_km: distanceKm,
    duration_mins: durationMins,
    vehicle_options: vehicleOptions,
    selected,
  };
}

export async function placeCourierOrder(user, payload = {}) {
  if (!user?.email) throw new Error('Not authenticated');

  const pickup = payload.pickup || {};
  const dropoff = payload.dropoff || {};
  const vehicleType = normalizeCourierVehicle(payload.vehicle_type);
  if (!vehicleType) throw new Error('Select a vehicle type');
  if (!pickup.lat || !pickup.lng || !dropoff.lat || !dropoff.lng) {
    throw new Error('Pickup and drop-off locations are required');
  }
  if (!pickup.address?.trim() || !dropoff.address?.trim()) {
    throw new Error('Pickup and drop-off addresses are required');
  }

  const quote = await quoteCourier({
    pickup,
    dropoff,
    vehicle_type: vehicleType,
  });
  const option = quote.selected;
  if (!option?.available) {
    throw new Error(option?.unavailable_reason || `${option?.label || 'Vehicle'} is not available near pickup`);
  }

  const deliveryCode = String(Math.floor(1000 + Math.random() * 9000));
  const packageDescription = (payload.package_description || '').trim() || 'Courier package';
  const paymentMethod = payload.payment_method || 'ecocash';

  await ensureCourierPlatformMerchant();

  const orderPayload = {
    order_kind: 'courier',
    status: ORDER_STATUS.READY_FOR_PICKUP,
    shop_id: COURIER_PLATFORM_ID,
    merchant_id: COURIER_PLATFORM_ID,
    shop_name: 'DashZW Courier',
    merchant_name: 'DashZW Courier',
    merchant_category: 'courier',
    shop_address: pickup.address,
    shop_lat: Number(pickup.lat),
    shop_lng: Number(pickup.lng),
    pickup_address: pickup.address,
    pickup_lat: Number(pickup.lat),
    pickup_lng: Number(pickup.lng),
    pickup_contact: payload.pickup_contact || user.full_name || '',
    pickup_notes: payload.pickup_notes || '',
    delivery_address: dropoff.address,
    dest_lat: Number(dropoff.lat),
    dest_lng: Number(dropoff.lng),
    delivery_city: payload.dropoff_city || '',
    customer_phone: payload.recipient_phone || user.phone || '',
    delivery_notes: payload.dropoff_notes || '',
    package_description: packageDescription,
    required_vehicle_type: vehicleType,
    items: [{ name: packageDescription, quantity: 1, price: 0 }],
    customer_subtotal: 0,
    partner_subtotal: 0,
    platform_fee: 0,
    delivery_fee: option.delivery_fee,
    service_fee: option.service_fee,
    driver_earning: option.driver_earning,
    distance_km: quote.distance_km,
    estimated_delivery_time: option.estimated_delivery_time,
    payment_method: paymentMethod,
    delivery_code: deliveryCode,
    special_notes: `COURIER|${vehicleType}|${packageDescription}`,
    pack_progress: {
      courier_meta: {
        order_kind: 'courier',
        required_vehicle_type: vehicleType,
        package_description: packageDescription,
        pickup_address: pickup.address,
        pickup_lat: Number(pickup.lat),
        pickup_lng: Number(pickup.lng),
      },
    },
    total_before_wallet: option.delivery_fee,
    is_pickup: false,
  };

  const result = await placeOrder(user, orderPayload);

  await createNotification({
    recipient_email: '__drivers__',
    title: '📦 New courier job',
    body: `${vehicleType} pickup near ${pickup.address.split(',')[0]} — earn $${option.driver_earning.toFixed(2)}`,
    type: 'new_order',
    link: '/jobs',
  });

  return {
    ...result,
    delivery_code: deliveryCode,
    quote: option,
  };
}
