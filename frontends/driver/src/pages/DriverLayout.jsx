import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Bike, ClipboardList, User, Menu, X, LayoutDashboard, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import NotificationBell from '@/components/shared/NotificationBell';

const navItems = [
  { path: '/',        label: 'Dashboard',      icon: LayoutDashboard, exact: true },
  { path: '/jobs',    label: 'Available Jobs', icon: Bike },
  { path: '/active',  label: 'My Deliveries',  icon: ClipboardList },
  { path: '/wallet',  label: 'Wallet',         icon: Wallet },
  { path: '/profile', label: 'Profile',        icon: User },
];

export default function DriverLayout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout } = useAuth();

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
            <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center">
              <Bike className="w-4 h-4 text-accent-foreground" />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">DashZW</p>
              <p className="text-[10px] text-muted-foreground">Driver Portal</p>
            </div>
          </div>
          <button onClick={() => setMobileOpen(false)} className="lg:hidden">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => (
            <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                isActive(item) ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}>
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-border">
          <button onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground w-full transition-colors">
            <X className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center gap-3 lg:hidden">
          <button onClick={() => setMobileOpen(true)}><Menu className="w-5 h-5 text-foreground" /></button>
          <span className="font-bold text-foreground flex-1">Driver Portal</span>
          <NotificationBell />
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-auto"><Outlet /></main>
      </div>
    </div>
  );
}
