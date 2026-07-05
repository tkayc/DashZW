import React, { useEffect, useState } from 'react';
import { createLocationApi } from '@location/api/locationApi.js';
import { getApiBaseUrl, getToken } from '@/api/client.js';
import PlatformMap from '@location/components/PlatformMap.jsx';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const locationApi = createLocationApi({ getApiBaseUrl, getToken });

export default function AdminLiveMap() {
  const [snapshot, setSnapshot] = useState({ drivers: [], orders: [], merchants: [] });
  const [filters, setFilters] = useState({ city: '', status: '', driver_email: '' });
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await locationApi.getLiveOps(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
      setSnapshot(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [filters.city, filters.status, filters.driver_email]);

  const activeOrder = selectedOrder || snapshot.orders[0];
  const route = activeOrder?.routes?.[0]?.polyline;

  return (
    <div className="p-4 space-y-4 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Live Operations Map</h1>
        <p className="text-sm text-muted-foreground">Active drivers, deliveries, and merchants</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <Input placeholder="City filter" value={filters.city} onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))} className="rounded-xl" />
        <Input placeholder="Driver email" value={filters.driver_email} onChange={(e) => setFilters((f) => ({ ...f, driver_email: e.target.value }))} className="rounded-xl" />
        <Select value={filters.status || 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, status: v === 'all' ? '' : v }))}>
          <SelectTrigger className="rounded-xl"><SelectValue placeholder="Order status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="ready_for_pickup">Ready for pickup</SelectItem>
            <SelectItem value="in_transit">In transit</SelectItem>
            <SelectItem value="preparing">Preparing</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={load} className="rounded-xl" disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</Button>
      </div>

      <PlatformMap
        height={420}
        merchant={activeOrder?.shop_lat ? { lat: activeOrder.shop_lat, lng: activeOrder.shop_lng, label: activeOrder.shop_name } : snapshot.merchants[0] ? { lat: snapshot.merchants[0].lat, lng: snapshot.merchants[0].lng, label: snapshot.merchants[0].name } : null}
        customer={activeOrder?.dest_lat ? { lat: activeOrder.dest_lat, lng: activeOrder.dest_lng, label: 'Customer' } : null}
        driver={activeOrder?.driver_lat ? { lat: activeOrder.driver_lat, lng: activeOrder.driver_lng, label: activeOrder.driver_name || 'Driver' } : null}
        markers={[
          ...snapshot.drivers.map((d) => ({ id: d.driver_email, lat: d.lat, lng: d.lng, label: d.driver_name, type: 'driver' })),
          ...snapshot.merchants.map((m) => ({ id: m.id, lat: m.lat, lng: m.lng, label: m.name, type: 'pickup' })),
        ]}
        route={route}
        loading={loading}
      />

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-semibold mb-2">Active deliveries ({snapshot.orders.length})</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {snapshot.orders.map((o) => (
              <button key={o.id} type="button" onClick={() => setSelectedOrder(o)} className={`w-full text-left p-3 rounded-xl border ${selectedOrder?.id === o.id ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <p className="font-semibold text-sm">{o.shop_name}</p>
                <p className="text-xs text-muted-foreground capitalize">{o.status?.replace(/_/g, ' ')}</p>
                <p className="text-[11px] text-muted-foreground truncate">{o.delivery_address}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
          <h3 className="font-semibold">Driver actions</h3>
          <p className="text-xs text-muted-foreground">Call / message placeholders for production telephony integration.</p>
          {activeOrder?.driver_email && (
            <>
              <Button variant="outline" className="w-full rounded-xl" onClick={() => toastPlaceholder('Call driver')}>📞 Call driver (placeholder)</Button>
              <Button variant="outline" className="w-full rounded-xl" onClick={() => toastPlaceholder('Message driver')}>💬 Message driver (placeholder)</Button>
              <p className="text-sm"><strong>ETA:</strong> {activeOrder.tracking_eta_mins || '—'} min</p>
              <p className="text-sm"><strong>Driver:</strong> {activeOrder.driver_name || activeOrder.driver_email}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function toastPlaceholder(action) {
  window.alert(`${action} — integrate with Twilio / in-app chat in production`);
}
