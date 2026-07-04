import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Bike, Store, ShoppingBag, LifeBuoy,
  BarChart3, Percent, Wallet, Tag, Bell, ScrollText, Activity,
  Settings, Shield, Menu, X, LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import NotificationBell from '@/components/shared/NotificationBell';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/drivers', label: 'Drivers', icon: Bike },
  { path: '/merchants', label: 'Merchants', icon: Store },
  { path: '/orders', label: 'Orders', icon: ShoppingBag },
  { path: '/support', label: 'Support', icon: LifeBuoy },
  { path: '/refunds', label: 'Refunds', icon: Wallet },
  { path: '/disputes', label: 'Disputes', icon: Shield },
  { path: '/reports', label: 'Reports', icon: ScrollText },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/commissions', label: 'Commissions', icon: Percent },
  { path: '/settlements', label: 'Settlement', icon: Wallet },
  { path: '/coupons', label: 'Coupons', icon: Tag },
  { path: '/notifications', label: 'Notifications', icon: Bell },
  { path: '/audit', label: 'Audit Logs', icon: ScrollText },
  { path: '/monitoring', label: 'Monitoring', icon: Activity },
  { path: '/roles', label: 'Role Management', icon: Shield },
  { path: '/settings', label: 'Platform Settings', icon: Settings },
  { path: '/users', label: 'Users', icon: Users },
];

export default function AdminLayout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout } = useAuth();

  const isActive = (item) =>
    item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);

  return (
    <div className="min-h-screen bg-muted/30 flex">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col transition-transform duration-300',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0 lg:static lg:z-auto'
        )}
      >
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <p className="font-bold text-foreground text-sm">DashZW Admin</p>
            <p className="text-[10px] text-muted-foreground">Enterprise console</p>
          </div>
          <button type="button" onClick={() => setMobileOpen(false)} className="lg:hidden">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors',
                isActive(item)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="w-3.5 h-3.5 shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-border">
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted w-full"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center gap-3 lg:hidden">
          <button type="button" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold flex-1">Admin</span>
          <NotificationBell />
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
