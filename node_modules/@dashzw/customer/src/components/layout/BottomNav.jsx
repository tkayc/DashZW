import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ClipboardList, User, Compass } from 'lucide-react';

const navItems = [
  { path: '/', icon: Home, label: 'Home', exact: true },
  { path: '/explore', icon: Compass, label: 'Explore' },
  { path: '/orders', icon: ClipboardList, label: 'Orders' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border">
      <div className="max-w-lg mx-auto flex items-center justify-around py-2 px-2">
        {navItems.map(({ path, icon: Icon, label, exact }) => {
          const isActive = exact
            ? location.pathname === path
            : location.pathname === path || location.pathname.startsWith(`${path}/`);
          return (
            <Link
              key={path}
              to={path}
              className={`relative flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all duration-200 ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-[10px] ${isActive ? 'font-bold text-primary' : 'font-medium'}`}>
                {label}
              </span>
              {isActive && (
                <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-primary rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
