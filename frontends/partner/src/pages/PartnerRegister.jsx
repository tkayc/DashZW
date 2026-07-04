import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api';
import { Store, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MERCHANT_CATEGORIES } from '@/domain/merchantCategories';
import { MERCHANT_STAFF_ROLES } from '@/domain/merchantStaffRoles';

export default function PartnerRegister() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', category: '', address: '',
    city: 'Harare', phone: '', opening_hours: '', delivery_fee: '',
    estimated_delivery_time: '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const user = await base44.auth.me();
      // TODO(postgresql): Insert merchant, default branch, and owner staff in a transaction.
      const merchant = await base44.entities.Shop.create({
        ...form,
        delivery_fee: parseFloat(form.delivery_fee) || 0,
        owner_email: user.email,
        is_open: true,
        rating: 4.0,
        approval_status: 'pending',
      });
      const branch = await base44.entities.Branch.create({
        merchant_id: merchant.id,
        shop_id: merchant.id,
        name: 'Main',
        address: form.address,
        city: form.city,
        phone: form.phone,
        is_open: true,
        opening_hours: form.opening_hours,
        estimated_delivery_time: form.estimated_delivery_time,
        is_default: true,
      });
      await base44.entities.Shop.update(merchant.id, { default_branch_id: branch.id });
      await base44.entities.MerchantStaff.create({
        merchant_id: merchant.id,
        shop_id: merchant.id,
        branch_id: null,
        user_email: user.email,
        staff_role: MERCHANT_STAFF_ROLES.OWNER,
        is_active: true,
      });
      navigate('/');
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
          <Store className="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Register Your Merchant</h1>
        <p className="text-muted-foreground mt-1 text-sm">Join the DashZW merchant network</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <div className="space-y-1.5">
          <Label>Merchant Name *</Label>
          <Input required value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Mama's Kitchen" />
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Short description of your business" rows={2} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Category *</Label>
            <Select required value={form.category} onValueChange={v => set('category', v)}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                {MERCHANT_CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>City *</Label>
            <Input required value={form.city} onChange={e => set('city', e.target.value)} placeholder="Harare" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Address *</Label>
          <Input required value={form.address} onChange={e => set('address', e.target.value)} placeholder="Street address or shopping centre" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+263 ..." />
          </div>
          <div className="space-y-1.5">
            <Label>Delivery Fee ($)</Label>
            <Input type="number" min="0" step="0.5" value={form.delivery_fee} onChange={e => set('delivery_fee', e.target.value)} placeholder="2.00" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Opening Hours</Label>
            <Input value={form.opening_hours} onChange={e => set('opening_hours', e.target.value)} placeholder="8AM - 10PM" />
          </div>
          <div className="space-y-1.5">
            <Label>Delivery Time</Label>
            <Input value={form.estimated_delivery_time} onChange={e => set('estimated_delivery_time', e.target.value)} placeholder="20-35 min" />
          </div>
        </div>

        <Button type="submit" disabled={saving} className="w-full mt-2 rounded-xl">
          {saving ? 'Registering...' : 'Register Restaurant'}
          <ChevronRight className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}