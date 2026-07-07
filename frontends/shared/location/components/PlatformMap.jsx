/**
 * PlatformMap — Leaflet/OSM map with Google Maps styling hooks (PART 5 / 11).
 * TODO(Google Maps SDK): swap MapContainer for @react-google-maps/api when GOOGLE_MAPS_API_KEY is set in Vite env.
 */
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, LocateFixed, ZoomIn, ZoomOut } from 'lucide-react';
import { resolveApiBaseUrl } from '../../apiBaseUrl.js';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const makeIcon = (emoji, size = 34) =>
  L.divIcon({
    html: `<div style="font-size:${size}px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35))">${emoji}</div>`,
    className: '',
    iconAnchor: [size / 2, size],
  });

const ICONS = {
  merchant: makeIcon('🍽️'),
  customer: makeIcon('📍'),
  driver: makeIcon('🛵'),
  pickup: makeIcon('🏪'),
};

function FitBounds({ points, zoom = 14 }) {
  const map = useMap();
  useEffect(() => {
    const valid = (points || []).filter((p) => p?.lat != null && p?.lng != null);
    if (!valid.length) return;
    if (valid.length === 1) map.setView([valid[0].lat, valid[0].lng], zoom);
    else map.fitBounds(valid.map((p) => [p.lat, p.lng]), { padding: [40, 40] });
  }, [points, zoom, map]);
  return null;
}

function MapControls({ onLocate, showLocate = true }) {
  const map = useMap();
  return (
    <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
      {showLocate && (
        <button
          type="button"
          onClick={() => onLocate?.(map)}
          className="w-9 h-9 rounded-xl bg-card border border-border shadow-md flex items-center justify-center"
          title="Current location"
        >
          <LocateFixed className="w-4 h-4" />
        </button>
      )}
      <button type="button" onClick={() => map.zoomIn()} className="w-9 h-9 rounded-xl bg-card border border-border shadow-md flex items-center justify-center" title="Zoom in">
        <ZoomIn className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => map.zoomOut()} className="w-9 h-9 rounded-xl bg-card border border-border shadow-md flex items-center justify-center" title="Zoom out">
        <ZoomOut className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function PlatformMap({
  center,
  zoom = 14,
  height = 280,
  loading = false,
  offline = false,
  merchant,
  customer,
  driver,
  route = [],
  markers = [],
  onMapClick,
  showControls = true,
  className = '',
}) {
  const [tileUrl, setTileUrl] = useState('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');

  useEffect(() => {
    fetch(`${resolveApiBaseUrl()}/api/location/config`)
      .then((r) => r.json())
      .then((cfg) => {
        if (cfg.openstreetmap?.tileUrl) setTileUrl(cfg.openstreetmap.tileUrl);
      })
      .catch(() => {});
  }, []);

  const mapCenter = center || merchant || customer || driver || { lat: -26.1823, lng: 27.9985 };
  const points = [merchant, customer, driver, ...markers].filter(Boolean);

  if (offline) {
    return (
      <div className={`rounded-2xl border border-border bg-muted flex items-center justify-center text-sm text-muted-foreground ${className}`} style={{ height }}>
        Map unavailable offline
      </div>
    );
  }

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-border ${className}`} style={{ height }}>
      {loading && (
        <div className="absolute inset-0 z-[1001] bg-background/60 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}
      <MapContainer center={[mapCenter.lat, mapCenter.lng]} zoom={zoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer attribution='&copy; OpenStreetMap' url={tileUrl} />
        <FitBounds points={points} zoom={zoom} />
        {merchant?.lat != null && (
          <Marker position={[merchant.lat, merchant.lng]} icon={ICONS.merchant}>
            <Popup>{merchant.label || 'Merchant'}</Popup>
          </Marker>
        )}
        {customer?.lat != null && (
          <Marker position={[customer.lat, customer.lng]} icon={ICONS.customer}>
            <Popup>{customer.label || 'Delivery'}</Popup>
          </Marker>
        )}
        {driver?.lat != null && (
          <Marker position={[driver.lat, driver.lng]} icon={ICONS.driver}>
            <Popup>{driver.label || 'Driver'}</Popup>
          </Marker>
        )}
        {markers.map((m, i) =>
          m?.lat != null ? (
            <Marker key={m.id || i} position={[m.lat, m.lng]} icon={ICONS[m.type] || ICONS.customer}>
              <Popup>{m.label}</Popup>
            </Marker>
          ) : null
        )}
        {route?.length > 1 && (
          <Polyline positions={route.map((p) => [p.lat, p.lng])} color="#2563eb" weight={4} opacity={0.8} />
        )}
        {onMapClick && <ClickHandler onClick={onMapClick} />}
        {showControls && <MapControls onLocate={(map) => navigator.geolocation?.getCurrentPosition((pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 16))} />}
      </MapContainer>
    </div>
  );
}

function ClickHandler({ onClick }) {
  const map = useMap();
  useEffect(() => {
    const handler = (e) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    map.on('click', handler);
    return () => map.off('click', handler);
  }, [map, onClick]);
  return null;
}

export { ICONS, makeIcon };
