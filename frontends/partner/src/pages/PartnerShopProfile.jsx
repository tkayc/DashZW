import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44, invalidateCollection } from '@/api';
import { Save, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { MERCHANT_CATEGORIES } from '@/domain/merchantCategories';

const PROFILE_FIELDS = [
  'name',
  'description',
  'category',
  'address',
  'city',
  'phone',
  'min_order_amount',
  'opening_hours',
  'estimated_delivery_time',
  'image_url',
  'ecocash_number',
  'ecocash_name',
  'bank_name',
  'bank_account',
  'bank_account_name',
  'bank_branch',
];

function buildProfilePayload(form) {
  const payload = {};
  for (const key of PROFILE_FIELDS) {
    if (form[key] !== undefined && form[key] !== null) {
      payload[key] = form[key];
    }
  }
  return payload;
}

export default function PartnerShopProfile({ shop, onShopUpdate }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});
  const [dirty, setDirty] = useState(false);
  const shopIdRef = useRef(null);

  useEffect(() => {
    if (!shop) return;
    if (shopIdRef.current !== shop.id) {
      shopIdRef.current = shop.id;
      setForm({ ...shop });
      setDirty(false);
      return;
    }
    if (!dirty) setForm({ ...shop });
  }, [shop, dirty]);

  const set = (k, v) => {
    setDirty(true);
    setForm((f) => ({ ...f, [k]: v }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = buildProfilePayload(form);
      const updated = await base44.entities.Shop.update(shop.id, payload);
      setForm({ ...updated });
      setDirty(false);
      invalidateCollection('Shop');
      invalidateCollection('Branch');
      qc.invalidateQueries({ queryKey: ['partner-shop'] });
      onShopUpdate?.();
      toast.success('Business profile saved');
    } catch (err) {
      toast.error(err.message || 'Failed to save business profile');
    } finally {
      setSaving(false);
    }
  };

  const toggleOpen = async () => {
    const nextOpen = !form.is_open;
    setForm((f) => ({ ...f, is_open: nextOpen }));
    try {
      const updated = await base44.entities.Shop.update(shop.id, { is_open: nextOpen });
      setForm((f) => ({ ...f, ...updated }));
      invalidateCollection('Shop');
      qc.invalidateQueries({ queryKey: ['partner-shop'] });
      toast.success(nextOpen ? 'Shop is now open' : 'Shop is now closed');
    } catch (err) {
      setForm((f) => ({ ...f, is_open: !nextOpen }));
      toast.error(err.message || 'Could not update shop status');
    }
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Business Profile</h1>
          <p className="text-muted-foreground text-sm">Hours, contact info, and payout details</p>
        </div>
        <button
          type="button"
          onClick={toggleOpen}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            form.is_open
              ? 'bg-green-50 text-green-700 hover:bg-green-100'
              : 'bg-red-50 text-red-700 hover:bg-red-100'
          }`}
        >
          <Power className="w-4 h-4" />
          {form.is_open ? 'Open' : 'Closed'}
        </button>
      </div>

      <form onSubmit={handleSave} className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <div className="space-y-1.5">
          <Label>Business Name</Label>
          <Input value={form.name || ''} onChange={(e) => set('name', e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea value={form.description || ''} onChange={(e) => set('description', e.target.value)} rows={2} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={form.category || ''} onValueChange={(v) => set('category', v)}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {MERCHANT_CATEGORIES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>City</Label>
            <Input value={form.city || ''} onChange={(e) => set('city', e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Address</Label>
          <Input value={form.address || ''} onChange={(e) => set('address', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Min Order Amount (USD)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0 = no minimum"
              value={form.min_order_amount ?? ''}
              onChange={(e) => set('min_order_amount', parseFloat(e.target.value) || 0)}
              className="rounded-xl"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Opening Hours</Label>
            <Input value={form.opening_hours || ''} onChange={(e) => set('opening_hours', e.target.value)} placeholder="8:00 AM - 10:00 PM" />
          </div>
          <div className="space-y-1.5">
            <Label>Estimated Delivery Time</Label>
            <Input value={form.estimated_delivery_time || ''} onChange={(e) => set('estimated_delivery_time', e.target.value)} placeholder="20-35 min" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Cover Image URL</Label>
          <Input value={form.image_url || ''} onChange={(e) => set('image_url', e.target.value)} placeholder="https://..." />
        </div>

        <div className="border-t border-border pt-4 space-y-3">
          <div>
            <h3 className="font-semibold text-foreground text-sm">Payout Details</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Used by admin when settling your wallet balance</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Mobile Money Number</Label>
              <Input value={form.ecocash_number || ''} onChange={(e) => set('ecocash_number', e.target.value)} placeholder="+1 555 0100" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Account Name</Label>
              <Input value={form.ecocash_name || ''} onChange={(e) => set('ecocash_name', e.target.value)} placeholder="Account holder name" className="rounded-xl" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Bank Name</Label>
            <Input value={form.bank_name || ''} onChange={(e) => set('bank_name', e.target.value)} placeholder="e.g. Chase Bank" className="rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Bank Account Number</Label>
              <Input value={form.bank_account || ''} onChange={(e) => set('bank_account', e.target.value)} placeholder="Account number" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Account Holder Name</Label>
              <Input value={form.bank_account_name || ''} onChange={(e) => set('bank_account_name', e.target.value)} placeholder="Full name" className="rounded-xl" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Branch / Routing Number</Label>
            <Input value={form.bank_branch || ''} onChange={(e) => set('bank_branch', e.target.value)} placeholder="Branch or routing code" className="rounded-xl" />
          </div>
        </div>

        <Button type="submit" disabled={saving} className="rounded-xl">
          <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </form>
    </div>
  );
}
