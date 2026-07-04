import React, { useState, useEffect } from 'react';
import { base44 } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X } from 'lucide-react';

export default function MenuItemForm({ shopId, item, onSave, onCancel }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', price: '', category: '',
    image_url: '', is_available: true, is_popular: false,
  });

  useEffect(() => {
    if (item) setForm({ ...item, price: item.price?.toString() || '' });
  }, [item]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = { ...form, price: parseFloat(form.price) || 0, shop_id: shopId };
    if (item) {
      await base44.entities.MenuItem.update(item.id, data);
    } else {
      await base44.entities.MenuItem.create(data);
    }
    onSave();
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-foreground">{item ? 'Edit Item' : 'New Menu Item'}</h3>
        <button onClick={onCancel}><X className="w-5 h-5 text-muted-foreground" /></button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Name *</Label>
            <Input required value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Chicken Burger" />
          </div>
          <div className="space-y-1.5">
            <Label>Price ($) *</Label>
            <Input required type="number" min="0" step="0.1" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Input value={form.category} onChange={e => set('category', e.target.value)} placeholder="e.g. Burgers, Sides" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Brief description..." rows={2} />
        </div>
        <div className="space-y-1.5">
          <Label>Photo</Label>
          <div className="space-y-2">
            {/* Upload from device */}
            <label className="flex items-center gap-2 cursor-pointer">
              <div className="flex-1 flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2.5 border border-dashed border-border hover:bg-muted transition-colors">
                <span className="text-lg">📷</span>
                <span className="text-sm text-muted-foreground">Upload photo from device</span>
              </div>
              <input type="file" accept="image/*" className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = ev => set('image_url', ev.target.result);
                  reader.readAsDataURL(file);
                }} />
            </label>
            {/* Or paste URL */}
            <Input value={form.image_url?.startsWith('data:') ? '' : (form.image_url || '')}
              onChange={e => set('image_url', e.target.value)}
              placeholder="Or paste image URL: https://..." className="rounded-xl" />
            {/* Preview */}
            {form.image_url && (
              <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-border">
                <img src={form.image_url} alt="preview" className="w-full h-full object-cover" />
                <button type="button" onClick={() => set('image_url', '')}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/50 text-white rounded-full text-xs flex items-center justify-center">×</button>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_available} onChange={e => set('is_available', e.target.checked)} className="rounded" />
            <span className="text-sm text-foreground">Available</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_popular} onChange={e => set('is_popular', e.target.checked)} className="rounded" />
            <span className="text-sm text-foreground">Mark as Popular</span>
          </label>
        </div>
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1 rounded-xl">Cancel</Button>
          <Button type="submit" disabled={saving} className="flex-1 rounded-xl">
            {saving ? 'Saving...' : item ? 'Save Changes' : 'Add Item'}
          </Button>
        </div>
      </form>
    </div>
  );
}