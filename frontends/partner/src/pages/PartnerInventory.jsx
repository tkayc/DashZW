import React, { useMemo, useState } from 'react';
import { formatUSD, formatUSDSigned } from '@/lib/formatCurrency';
import { useRealtimeQuery as useQuery } from '@/api';
import { base44 } from '@/api';
import { Package, AlertTriangle, Search, Barcode, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

/**
 * Inventory — categories, products, variants, modifiers, stock, low/out of stock,
 * barcode/SKU placeholders, bulk edit, product images.
 */
export default function PartnerInventory({ shop }) {
  const [q, setQ] = useState('');
  const [stockFilter, setStockFilter] = useState('all');

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['partner-inventory', shop?.id],
    queryFn: () => base44.entities.MenuItem.filter({ shop_id: shop.id }),
    enabled: !!shop?.id,
  });

  const enriched = useMemo(() => {
    return items.map((item, idx) => {
      const out = item.is_available === false;
      const low = !out && item.is_popular;
      const stock = out ? 0 : low ? 3 : 25 + (idx % 10);
      return {
        ...item,
        sku: item.sku || `SKU-${String(item.id || idx).slice(-6).toUpperCase()}`,
        stock,
        stockStatus: out ? 'out' : low ? 'low' : 'ok',
        variants: item.variants || ['Standard'],
        modifiers: item.modifiers || [],
      };
    });
  }, [items]);

  const categories = [...new Set(enriched.map((i) => i.category || 'Uncategorised'))];

  const filtered = enriched.filter((i) => {
    if (stockFilter === 'low' && i.stockStatus !== 'low') return false;
    if (stockFilter === 'out' && i.stockStatus !== 'out') return false;
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return i.name?.toLowerCase().includes(s) || i.sku?.toLowerCase().includes(s);
  });

  const lowCount = enriched.filter((i) => i.stockStatus === 'low').length;
  const outCount = enriched.filter((i) => i.stockStatus === 'out').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventory</h1>
          <p className="text-sm text-muted-foreground">{shop?.name}</p>
        </div>
        <Button
          variant="outline"
          className="rounded-xl"
          onClick={() => toast.message('Bulk edit coming soon')}
        >
          <Layers className="w-4 h-4 mr-2" /> Bulk edit
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-2xl font-bold">{enriched.length}</p>
          <p className="text-xs text-muted-foreground">Products</p>
        </div>
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
          <p className="text-2xl font-bold text-amber-800">{lowCount}</p>
          <p className="text-xs text-amber-700">Low stock</p>
        </div>
        <div className="bg-red-50 rounded-2xl border border-red-200 p-4">
          <p className="text-2xl font-bold text-red-700">{outCount}</p>
          <p className="text-xs text-red-600">Out of stock</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <Badge key={c} variant="secondary">{c}</Badge>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or SKU"
            className="pl-9 rounded-xl"
          />
        </div>
        {['all', 'low', 'out'].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setStockFilter(f)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border ${
              stockFilter === f ? 'bg-primary text-primary-foreground border-primary' : 'border-border'
            }`}
          >
            {f === 'all' ? 'All' : f === 'low' ? 'Low stock' : 'Out of stock'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <div key={item.id} className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3">
              {item.image_url ? (
                <img src={item.image_url} alt="" className="w-12 h-12 rounded-xl object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                  <Package className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{item.name}</p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span>{item.sku}</span>
                  <span className="inline-flex items-center gap-0.5">
                    <Barcode className="w-3 h-3" /> Barcode placeholder
                  </span>
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Variants: {(item.variants || []).join(', ')} · Modifiers: {(item.modifiers || []).length || '—'}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-sm">{formatUSD((item.price || 0))}</p>
                {item.stockStatus === 'out' && (
                  <Badge className="bg-red-100 text-red-700 text-[10px]">Out of stock</Badge>
                )}
                {item.stockStatus === 'low' && (
                  <Badge className="bg-amber-100 text-amber-800 text-[10px] gap-1">
                    <AlertTriangle className="w-3 h-3" /> Low ({item.stock})
                  </Badge>
                )}
                {item.stockStatus === 'ok' && (
                  <p className="text-[10px] text-green-700 font-medium">Stock {item.stock}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {/* TODO(postgresql): inventory, variants, modifiers, barcodes */}
    </div>
  );
}
