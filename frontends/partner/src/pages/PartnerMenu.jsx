import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MenuItemForm from '@/components/partner/MenuItemForm';

export default function PartnerMenu({ shop }) {
  const qc = useQueryClient();
  const [editingItem, setEditingItem] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['partner-menu', shop?.id],
    queryFn: () => base44.entities.MenuItem.filter({ shop_id: shop.id }),
    enabled: !!shop?.id,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['partner-menu', shop?.id] });

  const handleDelete = async (id) => {
    if (!confirm('Delete this menu item?')) return;
    await base44.entities.MenuItem.delete(id);
    refresh();
  };

  const toggleAvailability = async (item) => {
    await base44.entities.MenuItem.update(item.id, { is_available: !item.is_available });
    refresh();
  };

  const grouped = items.reduce((acc, item) => {
    const cat = item.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  if (isLoading) return <div className="animate-pulse space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-2xl" />)}</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Menu Items</h1>
          <p className="text-muted-foreground text-sm">{items.length} items across {Object.keys(grouped).length} categories</p>
        </div>
        <Button onClick={() => { setEditingItem(null); setShowForm(true); }} className="rounded-xl">
          <Plus className="w-4 h-4" /> Add Item
        </Button>
      </div>

      {showForm && (
        <MenuItemForm
          shopId={shop.id}
          item={editingItem}
          onSave={() => { setShowForm(false); setEditingItem(null); refresh(); }}
          onCancel={() => { setShowForm(false); setEditingItem(null); }}
        />
      )}

      {items.length === 0 && !showForm && (
        <div className="bg-card rounded-2xl border border-border p-12 text-center">
          <UtensilsCrossed className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-semibold text-foreground">No menu items yet</p>
          <p className="text-sm text-muted-foreground mt-1">Add your first item to get started</p>
        </div>
      )}

      {Object.entries(grouped).map(([cat, catItems]) => (
        <div key={cat} className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <h3 className="font-semibold text-sm text-foreground">{cat}</h3>
          </div>
          <div className="divide-y divide-border">
            {catItems.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-4">
                {item.image_url && (
                  <img src={item.image_url} alt={item.name} className="w-14 h-14 rounded-xl object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-foreground truncate">{item.name}</p>
                    {item.is_popular && <Badge className="bg-accent/15 text-accent text-[10px] px-1.5 py-0">Popular</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.description}</p>
                  <p className="font-bold text-sm text-foreground mt-1">${item.price?.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => toggleAvailability(item)} title={item.is_available ? 'Mark unavailable' : 'Mark available'}>
                    {item.is_available
                      ? <ToggleRight className="w-6 h-6 text-primary" />
                      : <ToggleLeft className="w-6 h-6 text-muted-foreground" />}
                  </button>
                  <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => { setEditingItem(item); setShowForm(true); }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => handleDelete(item.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}