import React, { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import BottomNav from './BottomNav';
import FloatingCartBar from './FloatingCartBar';
import NotificationBell from '@/components/shared/NotificationBell';
import { ChevronDown, MapPin, Search, X, Check, Package } from 'lucide-react';
import DashZWLogo from '@shared/components/DashZWLogo.jsx';
import { delivery as deliveryIcon } from '@assets/icons/index.js';
import DeliveryAddressBar from '@/components/location/DeliveryAddressBar';
import { useCart } from '@/lib/CartContext';
import { useDeliveryLocation } from '@/lib/LocationContext';
import { formatDeliveryLine } from '@location/utils/deliveryAddress.js';
import { Input } from '@/components/ui/input';

// ── Delivery Mode Popup ───────────────────────────────────────────────────────
function DeliveryModePopup({ mode, onSelect, address, onAddressChange, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const options = [
    {
      id: 'delivery',
      icon: deliveryIcon,
      iconImg: true,
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
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="p-3 space-y-2">
          {options.map(opt => (
            <button key={opt.id} type="button" onClick={() => onSelect(opt.id)}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                mode === opt.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/60'
              }`}>
              {opt.iconImg ? (
                <img src={opt.icon} alt="" className="w-9 h-9 object-contain shrink-0" />
              ) : (
                <span className="text-2xl">{opt.icon}</span>
              )}
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
        {mode === 'delivery' && (
          <div className="px-4 pb-2">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-1.5">
              <MapPin className="w-3.5 h-3.5" /> Delivery address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => onAddressChange(e.target.value)}
              placeholder="Street, suburb, city"
              className="w-full rounded-xl bg-muted/60 px-3 py-2.5 text-sm outline-none border border-border"
            />
          </div>
        )}
        <div className="px-5 pb-5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AppLayout ─────────────────────────────────────────────────────────────────
export default function AppLayout() {
  const { deliveryMode, setDeliveryMode, setDeliveryAddress, itemCount } = useCart();
  const { delivery, setDelivery } = useDeliveryLocation();
  const headerAddress = formatDeliveryLine(delivery);
  const [showModePopup, setShowModePopup] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const searchInputRef = useRef(null);
  const isSearchPage = location.pathname === '/search';
  const urlQuery = searchParams.get('q') || '';
  const [searchDraft, setSearchDraft] = useState(urlQuery);

  useEffect(() => {
    setSearchDraft(isSearchPage ? urlQuery : '');
  }, [isSearchPage, urlQuery]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchDraft(value);
    const params = new URLSearchParams();
    if (value.trim()) params.set('q', value);
    navigate(`/search${params.toString() ? `?${params.toString()}` : ''}`, { replace: isSearchPage });
  };

  const handleSearchFocus = () => {
    if (!isSearchPage) navigate('/search');
  };

  const clearSearch = () => {
    setSearchDraft('');
    navigate('/search', { replace: true });
    searchInputRef.current?.focus();
  };

  const handleHeaderAddressChange = (value) => {
    setDeliveryAddress(value);
    setDelivery({
      ...(delivery || {}),
      formatted_address: value,
      street_address: value,
      lat: null,
      lng: null,
      source: 'manual',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <header className="sticky top-0 z-40 bg-card/98 backdrop-blur-lg border-b border-border">
        <div className="max-w-lg mx-auto px-4">

          {/* Top row: logo + bell */}
          <div className="flex items-center justify-between py-2.5 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Link to="/" className="flex items-center gap-2 shrink-0">
                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
                  <DashZWLogo className="w-4 h-4" />
                </div>
                <span className="font-bold text-foreground text-sm">DashZW</span>
              </Link>
              <Link
                to="/courier"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold border transition-colors shrink-0 ${
                  location.pathname === '/courier'
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-muted/60 text-foreground border-border hover:bg-muted'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                Courier
              </Link>
            </div>
            <NotificationBell />
          </div>

          <DeliveryAddressBar onClick={() => setShowModePopup(true)} />

          {/* Single search bar + delivery mode */}
          <div className="flex items-center gap-2 pb-2.5">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchInputRef}
                type="search"
                value={searchDraft}
                onChange={handleSearchChange}
                onFocus={handleSearchFocus}
                placeholder="Search merchants & products"
                className="pl-9 pr-9 rounded-2xl bg-muted/70 border-0 h-10 text-sm"
              />
              {searchDraft && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full hover:bg-muted flex items-center justify-center"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowModePopup(true)}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-2xl px-3 py-2.5 text-xs font-semibold shrink-0 hover:bg-primary/90 transition-colors whitespace-nowrap"
              title={headerAddress || 'Delivery address'}
            >
              <img src={deliveryIcon} alt="" className="w-4 h-4 object-contain" />
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
          address={headerAddress}
          onAddressChange={handleHeaderAddressChange}
          onClose={() => setShowModePopup(false)}
        />
      )}
    </div>
  );
}
