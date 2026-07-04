import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  Store, UtensilsCrossed, ClipboardList, LayoutDashboard, LogOut, Menu, X, Tag,
  Wallet, Bike, Package, BarChart3, Users, GitBranch, Star, Bell, UserCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import NotificationBell from '@/components/shared/NotificationBell';
import { getBalance } from '@/api';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/orders', label: 'Orders', icon: ClipboardList },
  { path: '/inventory', label: 'Inventory', icon: Package },
  { path: '/menu', label: 'Products', icon: UtensilsCrossed },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/customers', label: 'Customers', icon: UserCircle },
  { path: '/staff', label: 'Staff', icon: Users },
  { path: '/branches', label: 'Branches', icon: GitBranch },
  { path: '/reviews', label: 'Reviews', icon: Star },
  { path: '/notifications', label: 'Notifications', icon: Bell },
  { path: '/promotions', label: 'Promotions', icon: Tag },
  { path: '/earnings', label: 'Revenue', icon: Wallet },
  { path: '/driver-topup', label: 'Driver Top-Up', icon: Bike },
  { path: '/driver-withdrawal', label: 'Driver Withdrawal', icon: Wallet },
  { path: '/shop', label: 'Business Profile', icon: Store },
];

export default function PartnerLayout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout, user } = useAuth();
  const [balance, setBalance] = useState(0);
  useEffect(() => {
    if (!user?.email) return;
    getBalance(user.email, 'partner').then(setBalance).catch(() => setBalance(0));
  }, [user?.email]);

  const isActive = (item) =>
    item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);

  return (
    <div className="min-h-screen bg-muted/30 flex">
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col transition-transform duration-300",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        "lg:translate-x-0 lg:static lg:z-auto"
      )}>
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
              <Store className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">DashZW</p>
              <p className="text-[10px] text-muted-foreground">Merchant Portal</p>
            </div>
          </div>
          <button onClick={() => setMobileOpen(false)} className="lg:hidden">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Merchant wallet balance */}
        {balance > 0 && (
          <div className="mx-4 mt-3 bg-green-50 rounded-xl px-3 py-2 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-green-600" />
            <div>
              <p className="text-xs text-green-700 font-semibold">${balance.toFixed(2)} earned</p>
              <p className="text-[10px] text-green-600">Merchant wallet</p>
            </div>
          </div>
        )}

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => (
            <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                isActive(item) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}>
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <button onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground w-full transition-colors">
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center gap-3 lg:hidden">
          <button onClick={() => setMobileOpen(true)}><Menu className="w-5 h-5 text-foreground" /></button>
          <span className="font-bold text-foreground flex-1">Merchant Portal</span>
          <NotificationBell />
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-auto"><Outlet /></main>
      </div>
    </div>
  );
}
