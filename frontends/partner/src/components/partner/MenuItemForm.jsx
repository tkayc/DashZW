import React, { useState, useEffect } from 'react';
import { base44, getApiBaseUrl } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, Plus, Trash2, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { formatUSD } from '@/lib/formatCurrency';

async function uploadProductImage(dataUrl, filename) {
  const token = localStorage.getItem('dashzw_token');
  const res = await fetch(`${getApiBaseUrl()}/api/uploads/product-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ dataUrl, filename }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Image upload failed');
  return data.url;
}

function resolveImageSrc(url) {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  return `${getApiBaseUrl()}${url}`;
}

const emptyVariant = () => ({ id: '', name: '', priceDelta: '0', is_default: false });
const emptyAddon = () => ({ id: '', name: '', price: '0' });

export default function MenuItemForm({ shopId, item, onSave, onCancel }) {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    image_url: '',
    is_available: true,
    is_popular: false,
    hasVariants: false,
    hasAddons: false,
    images: [],
    variants: [emptyVariant()],
    addons: [emptyAddon()],
  });

  useEffect(() => {
    if (!item) return;
    setForm({
      name: item.name || '',
      description: item.description || '',
      price: item.price?.toString() || '',
      category: item.category || '',
      image_url: item.image_url || '',
      is_available: item.is_available !== false,
      is_popular: !!item.is_popular,
      hasVariants: (item.variants?.length || 0) > 0,
      hasAddons: (item.addons?.length || 0) > 0,
      images: item.image_urls?.length ? item.image_urls : item.image_url ? [item.image_url] : [],
      variants: item.variants?.length
        ? item.variants.map((v) => ({
            id: v.id,
            name: v.name,
            priceDelta: String(v.priceDelta ?? v.price_delta ?? 0),
            is_default: !!v.is_default,
          }))
        : [emptyVariant()],
      addons: item.addons?.length
        ? item.addons.map((a) => ({ id: a.id, name: a.name, price: String(a.price ?? 0) }))
        : [emptyAddon()],
    });
  }, [item]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleImagePick = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = [];
      for (const file of files) {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        if (String(dataUrl).startsWith('http')) {
          urls.push(dataUrl);
        } else {
          const url = await uploadProductImage(dataUrl, file.name);
          urls.push(url);
        }
      }
      setForm((f) => ({
        ...f,
        images: [...f.images, ...urls],
        image_url: f.image_url || urls[0] || '',
      }));
      toast.success(`${urls.length} image(s) uploaded`);
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeImage = (idx) => {
    setForm((f) => {
      const images = f.images.filter((_, i) => i !== idx);
      return { ...f, images, image_url: images[0] || '' };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description,
        price: parseFloat(form.price) || 0,
        category: form.category,
        shop_id: shopId,
        image_url: form.images[0] || form.image_url || null,
        images: form.images.length ? form.images : form.image_url ? [form.image_url] : [],
        is_available: form.is_available,
        is_popular: form.is_popular,
        variants: form.hasVariants
          ? form.variants
              .filter((v) => v.name.trim())
              .map((v, i) => ({
                id: v.id || undefined,
                name: v.name.trim(),
                priceDelta: parseFloat(v.priceDelta) || 0,
                is_default: i === 0,
              }))
          : [],
        addons: form.hasAddons
          ? form.addons
              .filter((a) => a.name.trim())
              .map((a) => ({
                id: a.id || undefined,
                name: a.name.trim(),
                price: parseFloat(a.price) || 0,
              }))
          : [],
      };

      if (item) await base44.entities.MenuItem.update(item.id, payload);
      else await base44.entities.MenuItem.create(payload);

      toast.success(item ? 'Product updated' : 'Product added');
      onSave();
    } catch (err) {
      toast.error(err.message || 'Could not save product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-foreground">{item ? 'Edit Product' : 'New Product'}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Prices in USD · images stored on server</p>
        </div>
        <button type="button" onClick={onCancel}><X className="w-5 h-5 text-muted-foreground" /></button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Name *</Label>
            <Input required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Margherita Pizza" />
          </div>
          <div className="space-y-1.5">
            <Label>Base price (USD) *</Label>
            <Input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => set('price', e.target.value)} placeholder="12.99" />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Input value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="Pizza, Burgers, Drinks" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What makes this item special?" rows={2} />
        </div>

        {/* Images */}
        <div className="space-y-2 rounded-xl border border-border p-3 bg-muted/20">
          <Label className="flex items-center gap-2"><ImagePlus className="w-4 h-4" /> Product photos</Label>
          <p className="text-xs text-muted-foreground">Upload from your device — saved to server (use cloud storage in production).</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <div className="flex-1 flex items-center gap-2 bg-background rounded-xl px-3 py-2.5 border border-dashed border-border hover:bg-muted/50">
              <span className="text-lg">📷</span>
              <span className="text-sm text-muted-foreground">{uploading ? 'Uploading…' : 'Add photo(s)'}</span>
            </div>
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleImagePick} disabled={uploading} />
          </label>
          <Input
            value={form.image_url?.startsWith('data:') ? '' : (form.image_url || '')}
            onChange={(e) => {
              const url = e.target.value;
              set('image_url', url);
              if (url) set('images', [url]);
            }}
            placeholder="Or paste image URL (https://...)"
            className="rounded-xl"
          />
          {form.images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {form.images.map((url, idx) => (
                <div key={`${url}-${idx}`} className="relative w-20 h-20 rounded-xl overflow-hidden border border-border">
                  <img src={resolveImageSrc(url)} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeImage(idx)} className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full text-xs">×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Variants */}
        <div className="space-y-2 rounded-xl border border-border p-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.hasVariants} onChange={(e) => set('hasVariants', e.target.checked)} className="rounded" />
            <span className="text-sm font-medium">Size / flavour options</span>
          </label>
          {form.hasVariants && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Base price + extra amount (e.g. Large +{formatUSD(3)}).</p>
              {form.variants.map((v, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input value={v.name} onChange={(e) => {
                    const variants = [...form.variants];
                    variants[idx] = { ...variants[idx], name: e.target.value };
                    set('variants', variants);
                  }} placeholder="Small / Medium / Large" className="flex-1" />
                  <Input type="number" step="0.01" value={v.priceDelta} onChange={(e) => {
                    const variants = [...form.variants];
                    variants[idx] = { ...variants[idx], priceDelta: e.target.value };
                    set('variants', variants);
                  }} placeholder="+0.00" className="w-24" />
                  <button type="button" onClick={() => set('variants', form.variants.filter((_, i) => i !== idx))} className="p-2 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => set('variants', [...form.variants, emptyVariant()])}>
                <Plus className="w-3 h-3 mr-1" /> Add option
              </Button>
            </div>
          )}
        </div>

        {/* Add-ons */}
        <div className="space-y-2 rounded-xl border border-border p-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.hasAddons} onChange={(e) => set('hasAddons', e.target.checked)} className="rounded" />
            <span className="text-sm font-medium">Add-ons (extra cheese, meat, etc.)</span>
          </label>
          {form.hasAddons && (
            <div className="space-y-2">
              {form.addons.map((a, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input value={a.name} onChange={(e) => {
                    const addons = [...form.addons];
                    addons[idx] = { ...addons[idx], name: e.target.value };
                    set('addons', addons);
                  }} placeholder="Extra cheese" className="flex-1" />
                  <Input type="number" step="0.01" min="0" value={a.price} onChange={(e) => {
                    const addons = [...form.addons];
                    addons[idx] = { ...addons[idx], price: e.target.value };
                    set('addons', addons);
                  }} placeholder="1.50" className="w-24" />
                  <button type="button" onClick={() => set('addons', form.addons.filter((_, i) => i !== idx))} className="p-2 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => set('addons', [...form.addons, emptyAddon()])}>
                <Plus className="w-3 h-3 mr-1" /> Add add-on
              </Button>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_available} onChange={(e) => set('is_available', e.target.checked)} className="rounded" />
            <span className="text-sm">Available</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_popular} onChange={(e) => set('is_popular', e.target.checked)} className="rounded" />
            <span className="text-sm">Popular</span>
          </label>
        </div>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1 rounded-xl">Cancel</Button>
          <Button type="submit" disabled={saving || uploading} className="flex-1 rounded-xl">
            {saving ? 'Saving…' : item ? 'Save changes' : 'Add product'}
          </Button>
        </div>
      </form>
    </div>
  );
}
