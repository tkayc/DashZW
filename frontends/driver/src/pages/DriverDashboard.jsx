import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRealtimeQuery as useQuery } from '@/api';
import { base44 } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import {
  Power, Map, Bell, Star, TrendingUp, Wallet, ClipboardList, ChevronRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useBalance } from '@/api';
import {
  normalizeOrderStatus,
  isTerminalOrderStatus,
  ORDER_STATUS,
} from '@/domain/orderStates';
import { toast } from 'sonner';

const ONLINE_KEY = 'dashzw_driver_online';

/**
 * Driver dashboard — go online/offline, earnings, current orders,
 * heat map placeholder, notifications, performance, ratings.
 */
export default function DriverDashboard() {
  const { user } = useAuth();
  const [online, setOnline] = useState(() => localStorage.getItem(ONLINE_KEY) !== 'false');
  const balance = useBalance(user?.email, 'driver');

  useEffect(() => {
    localStorage.setItem(ONLINE_KEY, online ? 'true' : 'false');
  }, [online]);

  const { data: orders = [] } = useQuery({
    queryKey: ['driver-dash-orders', user?.email],
    queryFn: () => base44.entities.Order.filter({ driver_email: user.email }, '-created_date', 200),
    enabled: !!user?.email,
  });

  const today = new Date().toDateString();
  const delivered = orders.filter((o) => {
    const s = normalizeOrderStatus(o.status);
    return s === ORDER_STATUS.DELIVERED || s === ORDER_STATUS.COMPLETED;
  });
  const todayOrders = delivered.filter((o) => new Date(o.updated_date || o.created_date).toDateString() === today);
  const todayEarnings = todayOrders.reduce((s, o) => s + (o.driver_earning || 0) + (o.driver_tip || 0), 0);

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekOrders = delivered.filter((o) => new Date(o.updated_date || o.created_date).getTime() >= weekAgo);
  const weekEarnings = weekOrders.reduce((s, o) => s + (o.driver_earning || 0) + (o.driver_tip || 0), 0);

  const current = orders.filter((o) => !isTerminalOrderStatus(o.status));
  const rating = 4.8; // mock
  const acceptanceRate = orders.length ? Math.round((delivered.length / Math.max(orders.length, 1)) * 100) : 100;

  const toggleOnline = () => {
    setOnline((v) => {
      const next = !v;
      toast.success(next ? 'You are online' : 'You are offline');
      return next;
    });
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Hi {user?.full_name?.split(' ')[0] || 'Driver'}</p>
        </div>
        <Button
          onClick={toggleOnline}
          className={`rounded-xl ${online ? 'bg-green-600 hover:bg-green-700' : 'bg-muted text-foreground hover:bg-muted/80'}`}
        >
          <Power className="w-4 h-4 mr-2" />
          {online ? 'Go Offline' : 'Go Online'}
        </Button>
      </div>

      <div className={`rounded-2xl border p-4 flex items-center gap-3 ${
        online ? 'bg-green-50 border-green-200' : 'bg-muted/50 border-border'
      }`}>
        <span className={`w-3 h-3 rounded-full ${online ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'}`} />
        <div>
          <p className="font-semibold text-sm">{online ? 'Available for jobs' : 'Unavailable'}</p>
          <p className="text-xs text-muted-foreground">Availability is stored locally for this demo</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Today&apos;s earnings</p>
          <p className="text-2xl font-bold text-green-700">R{todayEarnings.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{todayOrders.length} deliveries</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Weekly earnings</p>
          <p className="text-2xl font-bold text-foreground">R{weekEarnings.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{weekOrders.length} deliveries</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Wallet</p>
          <p className="text-2xl font-bold text-foreground">R{(balance || 0).toFixed(2)}</p>
          <Link to="/wallet" className="text-[10px] text-primary font-medium">View wallet →</Link>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Rating</p>
          <p className="text-2xl font-bold text-foreground flex items-center gap-1">
            <Star className="w-5 h-5 text-amber-500 fill-amber-500" /> {rating}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">Acceptance {acceptanceRate}%</p>
        </div>
      </div>

      {/* Heat map placeholder */}
      <div className="bg-card rounded-2xl border border-dashed border-border p-5 text-center">
        <Map className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="font-semibold text-sm">Demand heat map</p>
        <p className="text-xs text-muted-foreground mt-1">
          Hot zones and surge areas will appear here.
        </p>
        {/* TODO(maps): live demand heatmap */}
      </div>

      {/* Current orders */}
      <div className="bg-card rounded-2xl border border-border">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <p className="font-semibold text-sm flex items-center gap-2">
            <ClipboardList className="w-4 h-4" /> Current orders
          </p>
          <Badge variant="secondary">{current.length}</Badge>
        </div>
        {current.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No active deliveries</p>
        ) : (
          <div className="divide-y divide-border">
            {current.slice(0, 3).map((o) => (
              <Link key={o.id} to="/active" className="flex items-center justify-between p-4 hover:bg-muted/40">
                <div>
                  <p className="text-sm font-medium">{o.customer_name || 'Customer'}</p>
                  <p className="text-xs text-muted-foreground">{o.shop_name}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Performance */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <p className="font-semibold text-sm flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4" /> Performance
        </p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-muted/50 rounded-xl py-2">
            <p className="text-lg font-bold">{delivered.length}</p>
            <p className="text-[10px] text-muted-foreground">Completed</p>
          </div>
          <div className="bg-muted/50 rounded-xl py-2">
            <p className="text-lg font-bold">{acceptanceRate}%</p>
            <p className="text-[10px] text-muted-foreground">Accept rate</p>
          </div>
          <div className="bg-muted/50 rounded-xl py-2">
            <p className="text-lg font-bold">{rating}</p>
            <p className="text-[10px] text-muted-foreground">Rating</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link to="/" className="bg-card border border-border rounded-2xl p-4 flex items-center gap-2 hover:bg-muted/40">
          <Bell className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Jobs & alerts</span>
        </Link>
        <Link to="/wallet" className="bg-card border border-border rounded-2xl p-4 flex items-center gap-2 hover:bg-muted/40">
          <Wallet className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Wallet</span>
        </Link>
      </div>
    </div>
  );
}
