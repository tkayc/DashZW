import React, { useEffect, useState } from 'react';
import { createLocationApi } from '@location/api/locationApi.js';
import { getApiBaseUrl, getToken } from '@/api/client.js';
import { base44 } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import PlatformMap from '@location/components/PlatformMap.jsx';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const locationApi = createLocationApi({ getApiBaseUrl, getToken });

export default function PartnerLiveMap() {
  const { user } = useAuth();
  const [shop, setShop] = useState(null);
  const [snapshot, setSnapshot] = useState({ orders: [], drivers: [] });
  const [radius, setRadius] = useState(8);

  useEffect(() => {
    if (!user?.email) return;
    base44.entities.Shop.filter({ owner_email: user.email }).then((rows) => {
      setShop(rows[0]);
      if (rows[0]?.default_branch_id) {
        base44.entities.Branch.filter({ id: rows[0].default_branch_id }).then((b) => {
          if (b[0]?.delivery_radius_km) setRadius(Number(b[0].delivery_radius_km));
        });
      }
    });
  }, [user?.email]);

  useEffect(() => {
    if (!shop?.id) return;
    const load = () =>
      locationApi.getLiveOps({ merchant_id: shop.id }).then(setSnapshot).catch(() => {});
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [shop?.id]);

  const active = snapshot.orders[0];

  const saveRadius = async () => {
    if (!shop?.default_branch_id) return;
    try {
      await base44.entities.Branch.update(shop.default_branch_id, { delivery_radius_km: Number(radius) });
      toast.success('Delivery radius updated');
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Delivery Map</h1>
        <p className="text-sm text-muted-foreground">Track incoming drivers and delivery area</p>
      </div>

      <PlatformMap
        height={320}
        merchant={shop?.lat ? { lat: shop.lat, lng: shop.lng, label: shop.name } : null}
        customer={active?.dest_lat ? { lat: active.dest_lat, lng: active.dest_lng, label: 'Customer' } : null}
        driver={active?.driver_lat ? { lat: active.driver_lat, lng: active.driver_lng, label: active.driver_name } : null}
      />

      <div className="bg-card border border-border rounded-2xl p-4 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Incoming driver ETA</p>
          <p className="font-semibold">{active?.tracking_eta_mins ? `${active.tracking_eta_mins} min` : '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Active orders</p>
          <p className="font-semibold">{snapshot.orders.length}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
        <Label>Delivery radius (km)</Label>
        <div className="flex gap-2">
          <Input type="number" min="1" step="0.5" value={radius} onChange={(e) => setRadius(e.target.value)} className="rounded-xl" />
          <Button onClick={saveRadius} className="rounded-xl">Save</Button>
        </div>
        <p className="text-xs text-muted-foreground">Customers outside this radius won't see your merchant in discovery.</p>
      </div>
    </div>
  );
}
