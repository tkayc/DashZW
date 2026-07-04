import React from 'react';
import { formatUSD, formatUSDSigned } from '@/lib/formatCurrency';
import { useNavigate } from 'react-router-dom';
import { Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/lib/CartContext';
import { getShopStatus } from '@/api';
import { toast } from 'sonner';

export default function MenuItemCard({ item, shop }) {
  const navigate = useNavigate();
  const { items, addItem, updateQuantity } = useCart();
  const { isOpen, closingSoon } = shop ? getShopStatus(shop) : { isOpen: true, closingSoon: false };
  const canOrder = isOpen && !closingSoon && item.is_available !== false;

  const cartItem = items.find((i) => i.menu_item_id === item.id && !i.variant_id);
  const quantity = cartItem?.quantity || 0;

  const openDetail = () => navigate(`/shop/${shop.id}/product/${item.id}`);

  const handleAdd = (e) => {
    e?.stopPropagation?.();
    const result = addItem(
      {
        menu_item_id: item.id,
        name: item.name,
        price: item.price,
        image_url: item.image_url,
      },
      shop
    );
    if (result === 'switched') {
      toast.info('Cart cleared — items from a different merchant were removed');
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openDetail}
      onKeyDown={(e) => e.key === 'Enter' && openDetail()}
      className="flex gap-3 p-3 bg-card rounded-xl border border-border/50 text-left w-full cursor-pointer hover:bg-muted/30 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-1.5">
          <h3 className="font-semibold text-sm text-foreground">{item.name}</h3>
          {item.is_popular && (
            <Badge className="bg-accent/15 text-accent text-[10px] px-1.5 py-0 shrink-0">Popular</Badge>
          )}
          {item.is_available === false && (
            <Badge className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0 shrink-0">Out of stock</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
        <p className="font-bold text-sm text-foreground mt-2">{formatUSD(item.price)}</p>
      </div>

      <div className="flex flex-col items-end justify-between shrink-0" onClick={(e) => e.stopPropagation()}>
        {item.image_url && (
          <img src={item.image_url} alt={item.name} className="w-20 h-20 rounded-xl object-cover" />
        )}
        <div className="mt-2">
          {quantity === 0 ? (
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!canOrder}
              className="rounded-xl bg-primary hover:bg-primary/90 h-8 px-4 text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={() => updateQuantity(item.id, quantity - 1)}
                className="w-7 h-7 rounded-lg"
              >
                <Minus className="w-3 h-3" />
              </Button>
              <span className="text-sm font-bold text-foreground w-4 text-center">{quantity}</span>
              <Button
                size="icon"
                onClick={handleAdd}
                className="w-7 h-7 rounded-lg bg-primary hover:bg-primary/90"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
