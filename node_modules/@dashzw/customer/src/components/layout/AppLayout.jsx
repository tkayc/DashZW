import React, { useState, useRef, useEffect } from 'react';
import { Outlet, Link } from 'react-router-dom';
import BottomNav from './BottomNav';
import FloatingCartBar from './FloatingCartBar';
import NotificationBell from '@/components/shared/NotificationBell';
import { UtensilsCrossed, ChevronDown, MapPin, Search, X, Check } from 'lucide-react';
import { useCart } from '@/lib/CartContext';

// ── Delivery Mode Popup ───────────────────────────────────────────────────────
function DeliveryModePopup({ mode, onSelect, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const options = [
    {
      id: 'delivery',
      icon: '🛵',
      label: 'Delivery',
      desc: 'Get it delivered to your address',
    },
    {
      id: 'pickup',
      icon: '🏪',
      label: 'Pickup',
      desc: 'Pick up your order yourself — no delivery fee',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onClick={onClose}>
      <div ref={ref} onClick={e => e.stopPropagation()}
        className="bg-card w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl border border-border shadow-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-2 flex items-center justify-between border-b border-border">
          <p className="font-bold text-foreground">How do you want it?</p>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="p-3 space-y-2">
          {options.map(opt => (
            <button key={opt.id} onClick={() => { onSelect(opt.id); onClose(); }}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                mode === opt.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/60'
              }`}>
              <span className="text-2xl">{opt.icon}</span>
              <div className="flex-1">
                <p className={`font-semibold text-sm ${mode === opt.id ? 'text-primary' : 'text-foreground'}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
              </div>
              {mode === opt.id && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
            </button>
          ))}
        </div>
        <div className="px-5 pb-5 pt-1">
          <p className="text-xs text-muted-foreground text-center">
            {mode === 'pickup'
              ? '✅ Pickup selected — delivery fee is waived'
              : '🛵 Delivery — fee calculated from distance'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── AppLayout ─────────────────────────────────────────────────────────────────
export default function AppLayout() {
  const { deliveryMode, setDeliveryMode, deliveryAddress, setDeliveryAddress, itemCount } = useCart();
  const [showModePopup, setShowModePopup] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <header className="sticky top-0 z-40 bg-card/98 backdrop-blur-lg border-b border-border">
        <div className="max-w-lg mx-auto px-4">

          {/* Top row: logo + bell */}
          <div className="flex items-center justify-between py-2.5">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <UtensilsCrossed className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              <span className="font-bold text-foreground text-sm">DashZW</span>
            </Link>
            <NotificationBell />
          </div>

          {/* Where to + search (Uber Eats–style) */}
          <Link
            to="/search"
            className="flex items-center gap-2 bg-muted/70 rounded-2xl px-3 py-2.5 mb-2 hover:bg-muted transition-colors"
          >
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground flex-1">Search merchants, products…</span>
          </Link>

          <div className="flex items-center gap-2 pb-3">
            <div className="flex-1 flex items-center gap-2 bg-muted/60 rounded-2xl px-3 py-2.5 min-w-0">
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              <input
                type="text"
                value={deliveryAddress}
                onChange={e => setDeliveryAddress(e.target.value)}
                placeholder={deliveryMode === 'pickup' ? 'Pickup — no address needed' : 'Where to? · Delivery address'}
                disabled={deliveryMode === 'pickup'}
                className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground flex-1 min-w-0 outline-none disabled:opacity-50"
              />
              {deliveryAddress && deliveryMode === 'delivery' && (
                <button onClick={() => setDeliveryAddress('')} className="shrink-0">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowModePopup(true)}
              className="flex items-center gap-1 bg-primary text-primary-foreground rounded-2xl px-3 py-2.5 text-xs font-semibold shrink-0 hover:bg-primary/90 transition-colors whitespace-nowrap">
              <span>{deliveryMode === 'pickup' ? 'Pickup' : 'Delivery'}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </header>

      {/* Page content — extra bottom pad when floating cart is visible */}
      <div className={`max-w-lg mx-auto ${itemCount > 0 ? 'pb-36' : 'pb-24'}`}>
        <Outlet />
      </div>

      <FloatingCartBar />
      <BottomNav />

      {showModePopup && (
        <DeliveryModePopup
          mode={deliveryMode}
          onSelect={setDeliveryMode}
          onClose={() => setShowModePopup(false)}
        />
      )}
    </div>
  );
}
