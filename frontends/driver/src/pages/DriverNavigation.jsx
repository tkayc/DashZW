import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api';
import { createLocationApi } from '@location/api/locationApi.js';
import { createNavigationService } from '@location/services/NavigationService.js';
import { getApiBaseUrl, getToken } from '@/api/client.js';
import PlatformMap from '@location/components/PlatformMap.jsx';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Navigation, MapPin, Package, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const locationApi = createLocationApi({ getApiBaseUrl, getToken });
const navigation = createNavigationService(locationApi);

const STEPS = [
  { key: 'to_merchant', label: 'Navigate to merchant', icon: MapPin },
  { key: 'pickup', label: 'Pickup order', icon: Package },
  { key: 'to_customer', label: 'Navigate to customer', icon: Navigation },
  { key: 'deliver', label: 'Deliver order', icon: CheckCircle2 },
];

export default function DriverNavigation() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [step, setStep] = useState(0);
  const [route, setRoute] = useState([]);
  const [eta, setEta] = useState(null);
  const [distanceRemaining, setDistanceRemaining] = useState(null);

  useEffect(() => {
    base44.entities.Order.filter({ id: orderId }).then((rows) => setOrder(rows[0]));
    const t = setInterval(() => {
      base44.entities.Order.filter({ id: orderId }).then((rows) => setOrder(rows[0]));
    }, 5000);
    return () => clearInterval(t);
  }, [orderId]);

  const destination = useMemo(() => {
    if (!order) return null;
    if (step < 2) {
      return order.shop_lat ? { lat: order.shop_lat, lng: order.shop_lng, label: order.shop_name } : null;
    }
    return order.dest_lat ? { lat: order.dest_lat, lng: order.dest_lng, label: 'Customer' } : null;
  }, [order, step]);

  const loadRoute = async () => {
    if (!order || !destination) return;
    const origin = order.driver_lat
      ? { lat: order.driver_lat, lng: order.driver_lng }
      : destination;
    try {
      const r = await navigation.getRoute(
        orderId,
        origin,
        destination,
        step < 2 ? 'to_merchant' : 'to_customer'
      );
      setRoute(r.polyline || []);
      setEta(r.duration_mins);
      setDistanceRemaining(r.distance_km);
    } catch (e) {
      toast.error(e.message);
    }
  };

  useEffect(() => { loadRoute(); }, [order?.driver_lat, destination, step]);

  if (!order) {
    return <div className="p-8 text-center"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin mx-auto" /></div>;
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="p-4 flex items-center gap-3 border-b border-border">
        <button type="button" onClick={() => navigate('/active')}><ArrowLeft className="w-5 h-5" /></button>
        <div>
          <h1 className="font-bold">Navigation</h1>
          <p className="text-xs text-muted-foreground">{order.shop_name}</p>
        </div>
      </div>

      <div className="px-4 py-3 flex gap-2 overflow-x-auto">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setStep(i)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border ${step === i ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}
            >
              <Icon className="w-3.5 h-3.5" /> {s.label}
            </button>
          );
        })}
      </div>

      <div className="px-4">
        <PlatformMap
          height={360}
          merchant={order.shop_lat ? { lat: order.shop_lat, lng: order.shop_lng, label: order.shop_name } : null}
          customer={order.dest_lat ? { lat: order.dest_lat, lng: order.dest_lng, label: 'Customer' } : null}
          driver={order.driver_lat ? { lat: order.driver_lat, lng: order.driver_lng, label: 'You' } : null}
          route={route}
        />
      </div>

      <div className="px-4 mt-4 grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground">ETA</p>
          <p className="text-lg font-bold">{eta != null ? `${eta} min` : '—'}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground">Distance remaining</p>
          <p className="text-lg font-bold">{distanceRemaining != null ? `${distanceRemaining} km` : '—'}</p>
        </div>
      </div>

      <div className="px-4 mt-4 space-y-2">
        <Button className="w-full rounded-xl" onClick={() => destination && navigation.openExternal(destination.lat, destination.lng)}>
          Open in Google Maps
        </Button>
        <Button variant="outline" className="w-full rounded-xl" onClick={() => navigation.voiceNavigationPlaceholder()}>
          Voice navigation (placeholder)
        </Button>
        <p className="text-[11px] text-center text-muted-foreground">Traffic-aware routing placeholder — enable Google Directions API in production</p>
      </div>
    </div>
  );
}
