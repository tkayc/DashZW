import React, { useEffect, useState } from 'react';
import { formatUSD, formatUSDSigned } from '@/lib/formatCurrency';
import { Link, useNavigate } from 'react-router-dom';
import {
  Minus, Plus, Trash2, ShoppingBag, Tag, Wallet, Bookmark, Store,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useCart } from '@/lib/CartContext';
import { useAuth } from '@/lib/AuthContext';
import { getBalance } from '@/api';
import { toast } from 'sonner';

const TIP_PRESETS = [0, 5, 10, 20];

/**
 * Shopping cart — coupons, voucher, wallet preview, tip, instructions,
 * special notes, quantity, save cart, multi-merchant placeholder.
 */
export default function Cart() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    items, shopName, subtotal, updateQuantity, removeItem, clearCart, itemCount,
    deliveryInstructions, setDeliveryInstructions,
    specialNotes, setSpecialNotes,
    driverTip, setDriverTip,
    cartCoupon, setCartCoupon,
    cartVoucher, setCartVoucher,
    useWalletPreview, setUseWalletPreview,
    saveCart, restoreSavedCart, hasSavedCart, multiMerchantEnabled,
  } = useCart();

  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    if (!user?.email) return;
    getBalance(user.email, 'customer').then(setWalletBalance).catch(() => setWalletBalance(0));
  }, [user?.email]);

  if (items.length === 0) {
    return (
      <div className="px-4 pt-6">
        <h1 className="text-2xl font-bold text-foreground mb-8">Cart</h1>
        <div className="text-center py-12">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingBag className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="font-semibold text-foreground">Your cart is empty</p>
          <p className="text-sm text-muted-foreground mt-1">Browse merchants and add products</p>
          {hasSavedCart && (
            <Button
              variant="outline"
              className="mt-4 rounded-xl"
              onClick={() => {
                if (restoreSavedCart()) toast.success('Saved cart restored');
              }}
            >
              <Bookmark className="w-4 h-4 mr-2" />
              Restore saved cart
            </Button>
          )}
          <Link to="/explore">
            <Button className="mt-4 rounded-xl bg-primary hover:bg-primary/90">
              Explore Merchants
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const tipAmount = driverTip || 0;
  const walletPreview = useWalletPreview ? Math.min(walletBalance, subtotal + tipAmount) : 0;

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Cart</h1>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (saveCart()) toast.success('Cart saved for later');
            }}
            className="text-xs"
          >
            <Bookmark className="w-3.5 h-3.5 mr-1" />
            Save
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearCart}
            className="text-destructive hover:text-destructive text-xs"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Clear
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        From <span className="font-semibold text-foreground">{shopName}</span>
      </p>

      {/* Multi-merchant placeholder */}
      {!multiMerchantEnabled && (
        <div className="bg-muted/50 border border-border/50 rounded-xl px-3 py-2 flex items-start gap-2">
          <Store className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground">
            One merchant per cart for now. Multi-merchant cart is planned.
            {/* TODO(backend): multi-merchant cart */}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => {
          const key = item._key || item.menu_item_id;
          return (
            <div key={key} className="flex items-center gap-3 bg-card rounded-xl p-3 border border-border/50">
              {item.image_url && (
                <img src={item.image_url} alt={item.name} className="w-16 h-16 rounded-xl object-cover" />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-foreground">{item.name}</h3>
                {(item.variant_name || item.addon_names?.length > 0) && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                    {[item.variant_name, ...(item.addon_names || [])].filter(Boolean).join(' · ')}
                  </p>
                )}
                <p className="font-bold text-sm text-primary mt-1">
                  {formatUSD((item.price * item.quantity))}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => updateQuantity(key, item.quantity - 1)}
                  className="w-7 h-7 rounded-lg"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3 h-3" />
                </Button>
                <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                <Button
                  size="icon"
                  onClick={() => updateQuantity(key, item.quantity + 1)}
                  className="w-7 h-7 rounded-lg bg-primary hover:bg-primary/90"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Coupons & voucher */}
      <div className="bg-card rounded-2xl p-4 border border-border/50 space-y-3">
        <p className="font-semibold text-sm flex items-center gap-2">
          <Tag className="w-4 h-4 text-primary" /> Coupons & vouchers
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="Coupon code"
            value={cartCoupon}
            onChange={(e) => setCartCoupon(e.target.value)}
            className="rounded-xl"
          />
          <Button
            variant="outline"
            className="rounded-xl shrink-0"
            onClick={() => toast.success(cartCoupon ? 'Coupon will apply at checkout' : 'Enter a code')}
          >
            Apply
          </Button>
        </div>
        <Input
          placeholder="Gift voucher / promo code"
          value={cartVoucher}
          onChange={(e) => setCartVoucher(e.target.value)}
          className="rounded-xl"
        />
        <p className="text-[10px] text-muted-foreground">Codes are validated at checkout.</p>
      </div>

      {/* Wallet */}
      {walletBalance > 0 && (
        <label className="flex items-center gap-3 bg-card rounded-2xl p-4 border border-border/50 cursor-pointer">
          <input
            type="checkbox"
            checked={useWalletPreview}
            onChange={(e) => setUseWalletPreview(e.target.checked)}
            className="rounded"
          />
          <Wallet className="w-4 h-4 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">Use wallet balance</p>
            <p className="text-xs text-muted-foreground">{formatUSD(walletBalance)} available</p>
          </div>
        </label>
      )}

      {/* Driver tip */}
      <div className="bg-card rounded-2xl p-4 border border-border/50">
        <p className="font-semibold text-sm mb-2">Driver tip</p>
        <div className="flex flex-wrap gap-2">
          {TIP_PRESETS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setDriverTip(t)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium border ${
                tipAmount === t ? 'border-primary bg-primary/10 text-primary' : 'border-border'
              }`}
            >
              {t === 0 ? 'None' : `${formatUSD(t)}`}
            </button>
          ))}
        </div>
      </div>

      {/* Delivery instructions */}
      <div className="bg-card rounded-2xl p-4 border border-border/50 space-y-3">
        <p className="font-semibold text-sm">Delivery instructions</p>
        <Textarea
          placeholder="Gate code, landmark, leave at door…"
          value={deliveryInstructions}
          onChange={(e) => setDeliveryInstructions(e.target.value)}
          className="rounded-xl min-h-[72px]"
        />
        <p className="font-semibold text-sm">Special notes</p>
        <Textarea
          placeholder="Allergies, substitutions, merchant notes…"
          value={specialNotes}
          onChange={(e) => setSpecialNotes(e.target.value)}
          className="rounded-xl min-h-[72px]"
        />
      </div>

      {/* Summary */}
      <div className="bg-card rounded-2xl p-4 border border-border/50">
        <h3 className="font-semibold text-foreground mb-3">Order Summary</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal ({itemCount} items)</span>
            <span className="font-medium">{formatUSD(subtotal)}</span>
          </div>
          {tipAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Driver tip</span>
              <span className="font-medium">{formatUSD(tipAmount)}</span>
            </div>
          )}
          {walletPreview > 0 && (
            <div className="flex justify-between text-sm text-green-700">
              <span>Wallet (preview)</span>
              <span>−{formatUSD(walletPreview)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Delivery fee</span>
            <span className="font-medium text-muted-foreground italic">At checkout</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between">
            <span className="font-bold">Est. subtotal</span>
            <span className="font-bold text-lg">
              {formatUSD(Math.max(0, subtotal + tipAmount - walletPreview))}
            </span>
          </div>
        </div>
      </div>

      <Button
        className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base"
        onClick={() => navigate('/checkout')}
      >
        Proceed to Checkout
      </Button>
    </div>
  );
}
