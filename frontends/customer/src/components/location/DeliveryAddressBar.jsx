import React from 'react';
import { Loader2, ChevronDown, LocateFixed } from 'lucide-react';
import { delivery as deliveryIcon } from '@assets/icons/index.js';
import { useDeliveryLocation } from '@/lib/LocationContext';
import { Link } from 'react-router-dom';

export default function DeliveryAddressBar({ onClick }) {
  const { delivery, loading, error, refreshFromGps } = useDeliveryLocation();

  return (
    <div className="pb-2">
      <div className="rounded-xl bg-muted/60 border border-border/80 px-2.5 py-2">
        <button
          type="button"
          onClick={onClick}
          className="w-full flex items-center gap-2 text-left min-w-0"
        >
          <img src={deliveryIcon} alt="" className="w-3.5 h-3.5 shrink-0 object-contain" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide leading-none">
              Delivering to
            </p>
            {loading ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                <span className="truncate">Detecting…</span>
              </p>
            ) : (
              <p className="text-xs font-semibold text-foreground truncate mt-0.5">
                {delivery?.formatted_address || delivery?.street_address || 'Set delivery address'}
              </p>
            )}
            {error && !delivery && (
              <p className="text-[10px] text-amber-700 truncate mt-0.5">{error}</p>
            )}
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        </button>

        <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-border/50">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              refreshFromGps();
            }}
            className="text-[10px] font-semibold text-primary flex items-center gap-1 shrink-0"
          >
            <LocateFixed className="w-3 h-3" />
            Current location
          </button>
          <span className="text-border text-[10px]">·</span>
          <Link
            to="/addresses"
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] font-semibold text-muted-foreground hover:text-foreground truncate"
          >
            Manage addresses
          </Link>
        </div>
      </div>
    </div>
  );
}
