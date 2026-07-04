import React from 'react';
import { formatUSD, formatUSDSigned } from '@/lib/formatCurrency';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '@/lib/CartContext';

/**
 * Floating cart summary — only visible when the cart has items.
 * Replaces the permanent bottom-nav cart tab.
 */
export default function FloatingCartBar() {
  const { itemCount, subtotal, shopName } = useCart();
  const location = useLocation();

  // Hide on cart/checkout (user is already in cart flow)
  const hideOn = ['/cart', '/checkout'];
  if (!itemCount || hideOn.some((p) => location.pathname.startsWith(p))) return null;

  return (
    <div className="fixed bottom-20 left-0 right-0 z-40 px-4 pointer-events-none">
      <div className="max-w-lg mx-auto pointer-events-auto">
        <Link
          to="/cart"
          className="flex items-center justify-between gap-3 bg-primary text-primary-foreground rounded-2xl px-4 py-3.5 shadow-xl shadow-primary/25 hover:bg-primary/95 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary-foreground/20 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight">
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </p>
              {shopName && (
                <p className="text-[11px] text-primary-foreground/80 truncate">{shopName}</p>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold">{formatUSD(subtotal)}</p>
            <p className="text-[10px] text-primary-foreground/80">View cart</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
