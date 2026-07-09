import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Loader2, MapPin, Zap } from 'lucide-react';
import { useRealtimeQuery as useQuery } from '@/api';
import { getApiBaseUrl, getToken } from '@/api';
import { createLocationApi } from '@location/api/locationApi.js';
import PlatformMap from '@location/components/PlatformMap.jsx';
import { formatUSD } from '@/lib/formatCurrency';

const locationApi = createLocationApi({ getApiBaseUrl, getToken });

function useDriverGps() {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    if (!navigator.geolocation) return undefined;
    const id = navigator.geolocation.watchPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);
  return pos;
}

export default function DemandHeatMap({ height = 260 }) {
  const driverPos = useDriverGps();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['driver-demand-zones', driverPos?.lat?.toFixed?.(3), driverPos?.lng?.toFixed?.(3)],
    queryFn: () =>
      locationApi.getDemandZones(
        driverPos
          ? { lat: driverPos.lat, lng: driverPos.lng, radius_km: 25 }
          : {}
      ),
    refetchInterval: 8000,
  });

  const zones = data?.zones || [];
  const points = data?.points || [];
  const surge = data?.surge;
  const openJobs = data?.open_jobs ?? points.length;

  const circles = useMemo(
    () =>
      zones.map((z) => ({
        id: z.id,
        lat: z.lat,
        lng: z.lng,
        radius_m: z.radius_m,
        color: z.color,
        stroke: z.stroke,
        fillOpacity: 0.28 + Math.min(0.35, (z.intensity || 0) * 0.35),
        label: `${z.count} open job${z.count === 1 ? '' : 's'}${
          z.sample_names?.length ? ` · ${z.sample_names[0]}` : ''
        }${z.total_earning ? ` · ~${formatUSD(z.total_earning)}` : ''}`,
      })),
    [zones]
  );

  const markers = useMemo(
    () =>
      points.slice(0, 40).map((p) => ({
        id: p.order_id,
        lat: p.lat,
        lng: p.lng,
        type: 'pickup',
        label: `${p.shop_name || 'Pickup'}${p.driver_earning ? ` · ${formatUSD(p.driver_earning)}` : ''}`,
      })),
    [points]
  );

  const fitPoints = useMemo(() => {
    const list = [...circles, ...markers];
    if (driverPos) list.push(driverPos);
    return list;
  }, [circles, markers, driverPos]);

  const topZone = zones[0];

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="p-4 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-sm flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" />
            Demand heat map
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isLoading && !data
              ? 'Loading hot zones…'
              : openJobs > 0
                ? `${openJobs} open pickup${openJobs === 1 ? '' : 's'} · updates live`
                : 'No open pickups with locations right now'}
          </p>
        </div>
        <Link to="/jobs" className="text-xs font-semibold text-primary shrink-0">
          View jobs →
        </Link>
      </div>

      {surge?.active && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl bg-orange-50 border border-orange-200 px-3 py-2">
          <Zap className="w-4 h-4 text-orange-600 shrink-0" />
          <p className="text-xs text-orange-900">
            <span className="font-bold">{Number(surge.multiplier).toFixed(1)}× surge</span>
            {surge.reason ? ` — ${surge.reason}` : ''}
          </p>
        </div>
      )}

      {isError ? (
        <div className="px-4 pb-4 text-center space-y-2">
          <p className="text-sm text-muted-foreground">{error?.message || 'Could not load demand map'}</p>
          <button type="button" onClick={() => refetch()} className="text-xs font-semibold text-primary">
            Try again
          </button>
        </div>
      ) : (
        <div className="relative px-3 pb-3">
          <PlatformMap
            height={height}
            loading={isLoading && !data}
            driver={driverPos ? { ...driverPos, label: 'You' } : null}
            circles={circles}
            markers={markers}
            fitPoints={fitPoints.length ? fitPoints : undefined}
            center={driverPos || topZone || undefined}
            zoom={fitPoints.length <= 1 ? 13 : 12}
            className="border-0"
          />
          {!isLoading && openJobs === 0 && (
            <div className="absolute inset-x-3 bottom-6 z-[500] pointer-events-none flex justify-center">
              <div className="bg-card/95 border border-border rounded-xl px-3 py-2 text-xs text-muted-foreground shadow-sm flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" />
                Waiting for ready orders nearby
              </div>
            </div>
          )}
        </div>
      )}

      {topZone && openJobs > 0 && (
        <div className="px-4 pb-4 flex items-center justify-between gap-2 text-xs text-muted-foreground border-t border-border pt-3">
          <span>
            Hottest zone: <span className="font-semibold text-foreground">{topZone.count} jobs</span>
            {topZone.sample_names?.[0] ? ` near ${topZone.sample_names[0]}` : ''}
          </span>
          {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        </div>
      )}

      <div className="px-4 pb-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> Mild</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Warm</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-600" /> Hot</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-600" /> Very hot</span>
      </div>
    </div>
  );
}
