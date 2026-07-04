import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api';
import { Save, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { MERCHANT_CATEGORIES } from '@/domain/merchantCategories';

export default function PartnerShopProfile({ shop, onShopUpdate }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});

  useEffect(() => {
    if (shop) setForm({ ...shop });
  }, [shop]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    await base44.entities.Shop.update(shop.id, form);
    qc.invalidateQueries({ queryKey: ['partner-shop'] });
    onShopUpdate?.();
    toast.success('Shop profile updated!');
    setSaving(false);
  };

  const toggleOpen = async () => {
    const updated = { ...form, is_open: !form.is_open };
    setForm(updated);
    await base44.entities.Shop.update(shop.id, { is_open: !form.is_open });
    qc.invalidateQueries({ queryKey: ['partner-shop'] });
    toast.success(updated.is_open ? 'Shop is now open' : 'Shop is now closed');
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Shop Profile</h1>
          <p className="text-muted-foreground text-sm">Manage your restaurant details</p>
        </div>
        <button
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
          <Label>Restaurant Name</Label>
          <Input value={form.name || ''} onChange={e => set('name', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea value={form.description || ''} onChange={e => set('description', e.target.value)} rows={2} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={form.category || ''} onValueChange={v => set('category', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MERCHANT_CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>City</Label>
            <Input value={form.city || ''} onChange={e => set('city', e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Address</Label>
          <Input value={form.address || ''} onChange={e => set('address', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Min Order Amount (R)</Label>
            <Input type="number" min="0" step="5" placeholder="0 = no minimum"
              value={form.min_order_amount || ''} onChange={e => set('min_order_amount', parseFloat(e.target.value) || 0)}
              className="rounded-xl" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Opening Hours</Label>
            <Input value={form.opening_hours || ''} onChange={e => set('opening_hours', e.target.value)} placeholder="8AM - 10PM" />
          </div>
          <div className="space-y-1.5">
            <Label>Delivery Time</Label>
            <Input value={form.estimated_delivery_time || ''} onChange={e => set('estimated_delivery_time', e.target.value)} placeholder="20-35 min" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Cover Image URL</Label>
          <Input value={form.image_url || ''} onChange={e => set('image_url', e.target.value)} placeholder="https://..." />
        </div>

        {/* Payment / Payout Details */}
        <div className="border-t border-border pt-4 space-y-3">
          <div>
            <h3 className="font-semibold text-foreground text-sm">Payout Details</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Used by admin to settle your wallet balance</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>EcoCash Number</Label>
              <Input value={form.ecocash_number || ''} onChange={e => set('ecocash_number', e.target.value)} placeholder="07XX XXX XXX" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>EcoCash Name</Label>
              <Input value={form.ecocash_name || ''} onChange={e => set('ecocash_name', e.target.value)} placeholder="Account name" className="rounded-xl" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Bank Name</Label>
            <Input value={form.bank_name || ''} onChange={e => set('bank_name', e.target.value)} placeholder="e.g. CBZ Bank" className="rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Bank Account Number</Label>
              <Input value={form.bank_account || ''} onChange={e => set('bank_account', e.target.value)} placeholder="Account number" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Account Holder Name</Label>
              <Input value={form.bank_account_name || ''} onChange={e => set('bank_account_name', e.target.value)} placeholder="Full name" className="rounded-xl" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Branch / Sort Code</Label>
            <Input value={form.bank_branch || ''} onChange={e => set('bank_branch', e.target.value)} placeholder="Branch name or code" className="rounded-xl" />
          </div>
        </div>

        <Button type="submit" disabled={saving} className="rounded-xl">
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </form>
    </div>
  );
}