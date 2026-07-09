import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const makeIcon = (emoji, size = 36) =>
  L.divIcon({
    html: `<div style="font-size:${size}px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.3))">${emoji}</div>`,
    className: '',
    iconAnchor: [size / 2, size],
  });

const merchantIcon = makeIcon('🍽️');
const customerIcon   = makeIcon('📍');
const customer2Icon  = makeIcon('🟢');   // second customer — green dot
const driverIcon     = makeIcon('🛵');

async function geocode(address) {
  const q   = encodeURIComponent(address + ', Harare, Zimbabwe');
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
    { headers: { 'Accept-Language': 'en' } }
  );
  const data = await res.json();
  if (!data.length) return null;
  return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
}

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    const valid = positions.filter(Boolean);
    if (!valid.length) return;
    if (valid.length === 1) map.setView(valid[0], 15);
    else map.fitBounds(valid, { padding: [50, 50] });
  }, [positions.map(p => p?.join(',')).join('|')]);
  return null;
}

/**
 * Props:
 *  shopAddress      — merchant / branch address (string)
 *  deliveryAddress  — primary customer address (string)
 *  driverPosition   — [lat, lng] or null
 *  secondDelivery   — { address, label } for the second customer (multi-order)
 *  className
 */
export default function DeliveryMap({
  shopAddress,
  deliveryAddress,
  driverPosition,
  secondDelivery = null,
  className = 'h-[280px]',
  rounded = true,
}) {
  const [shopPos,     setShopPos]     = useState(null);
  const [deliveryPos, setDeliveryPos] = useState(null);
  const [dest2Pos,    setDest2Pos]    = useState(null);

  useEffect(() => {
    if (shopAddress)     geocode(shopAddress).then(setShopPos);
  }, [shopAddress]);

  useEffect(() => {
    if (deliveryAddress) geocode(deliveryAddress).then(setDeliveryPos);
  }, [deliveryAddress]);

  useEffect(() => {
    if (secondDelivery?.address) geocode(secondDelivery.address).then(setDest2Pos);
  }, [secondDelivery?.address]);

  const positions = [shopPos, deliveryPos, driverPosition, dest2Pos].filter(Boolean);
  const center    = driverPosition || shopPos || deliveryPos || [-17.8292, 31.0522];

  return (
    <div className={`overflow-hidden ${rounded ? 'rounded-2xl border border-border' : ''} ${className}`}>
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <FitBounds positions={positions} />

        {shopPos && (
          <Marker position={shopPos} icon={merchantIcon}>
            <Popup>🍽️ Merchant pickup</Popup>
          </Marker>
        )}
        {deliveryPos && (
          <Marker position={deliveryPos} icon={customerIcon}>
            <Popup>📍 Your delivery address</Popup>
          </Marker>
        )}
        {dest2Pos && (
          <Marker position={dest2Pos} icon={customer2Icon}>
            <Popup>🟢 {secondDelivery?.label || 'Second delivery'}</Popup>
          </Marker>
        )}
        {driverPosition && (
          <Marker position={driverPosition} icon={driverIcon}>
            <Popup>🛵 Driver — live location</Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Legend when there's a second delivery */}
      {secondDelivery && (
        <div className="bg-card border-t border-border px-3 py-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span>📍 Your address</span>
          <span>🟢 {secondDelivery.label}</span>
          <span>🛵 Driver</span>
        </div>
      )}
    </div>
  );
}
