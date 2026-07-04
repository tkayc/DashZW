import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRealtimeQuery as useQuery } from '@/api';
import { base44 } from '@/api';
import { Plus, Tag, Percent, Gift, Calendar, Trash2, ToggleLeft, ToggleRight, Copy, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const PROMO_TYPES = [
  { value: 'percentage_discount', label: 'Percentage Discount', icon: Percent, desc: 'e.g. 20% off your order' },
  { value: 'fixed_discount',      label: 'Fixed Amount Off',    icon: Tag,     desc: 'e.g. R2 off any order' },
  { value: 'bogo',                label: 'Buy One Get One',     icon: Gift,    desc: 'Buy 1 item, get 1 free' },
  { value: 'coupon_code',         label: 'Coupon Code',         icon: Copy,    desc: 'Customer enters a code at checkout' },
  { value: 'happy_hour',          label: 'Happy Hour / Special Day', icon: Calendar, desc: 'e.g. Terrific Wednesdays, Anniversary deals' },
  { value: 'free_delivery',       label: 'Free Delivery',       icon: Zap,     desc: 'Waive the delivery fee' },
];

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

const emptyForm = {
  title: '', description: '', promo_type: '', discount_value: '',
  coupon_code: '', min_order_amount: '', max_uses: '',
  applicable_days: [], start_date: '', end_date: '',
  is_active: true,
};

function PromoCard({ promo, onToggle, onDelete }) {
  const typeInfo = PROMO_TYPES.find(t => t.value === promo.promo_type) || PROMO_TYPES[0];
  const Icon = typeInfo.icon;

  return (
    <div className={`bg-card rounded-2xl border overflow-hidden transition-opacity ${promo.is_active ? 'border-border' : 'border-border/40 opacity-60'}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${promo.is_active ? 'bg-primary/10' : 'bg-muted'}`}>
              <Icon className={`w-5 h-5 ${promo.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="font-bold text-sm text-foreground">{promo.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{typeInfo.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => onToggle(promo)} title={promo.is_active ? 'Deactivate' : 'Activate'}>
              {promo.is_active
                ? <ToggleRight className="w-6 h-6 text-primary" />
                : <ToggleLeft className="w-6 h-6 text-muted-foreground" />}
            </button>
            <button onClick={() => onDelete(promo.id)} className="text-destructive hover:text-destructive/80 p-1">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {promo.description && (
          <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed">{promo.description}</p>
        )}

        <div className="flex flex-wrap gap-2 mt-3">
          {promo.promo_type === 'percentage_discount' && promo.discount_value && (
            <Badge className="bg-green-100 text-green-700 text-xs">{promo.discount_value}% OFF</Badge>
          )}
          {promo.promo_type === 'fixed_discount' && promo.discount_value && (
            <Badge className="bg-green-100 text-green-700 text-xs">${promo.discount_value} OFF</Badge>
          )}
          {promo.promo_type === 'bogo' && (
            <Badge className="bg-purple-100 text-purple-700 text-xs">Buy 1 Get 1 Free</Badge>
          )}
          {promo.promo_type === 'free_delivery' && (
            <Badge className="bg-blue-100 text-blue-700 text-xs">Free Delivery</Badge>
          )}
          {promo.coupon_code && (
            <Badge className="bg-orange-100 text-orange-700 text-xs font-mono">Code: {promo.coupon_code}</Badge>
          )}
          {promo.min_order_amount && (
            <Badge variant="secondary" className="text-xs">Min order ${promo.min_order_amount}</Badge>
          )}
          {promo.applicable_days?.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {promo.applicable_days.length === 7 ? 'Every day' : promo.applicable_days.join(', ')}
            </Badge>
          )}
          {(promo.start_date || promo.end_date) && (
            <Badge variant="secondary" className="text-xs">
              {promo.start_date || '...'} → {promo.end_date || '...'}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function PromoForm({ shopId, onSave, onCancel }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleDay = (day) => {
    const days = form.applicable_days.includes(day)
      ? form.applicable_days.filter(d => d !== day)
      : [...form.applicable_days, day];
    set('applicable_days', days);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.promo_type) {
      toast.error('Please fill in the title and promotion type');
      return;
    }
    setSaving(true);
    try {
      await base44.entities.Promotion.create({
        ...form,
        shop_id: shopId,
        discount_value: form.discount_value ? parseFloat(form.discount_value) : null,
        min_order_amount: form.min_order_amount ? parseFloat(form.min_order_amount) : null,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        times_used: 0,
      });
      toast.success('Promotion created!');
      onSave();
    } catch (err) {
      toast.error('Failed to create promotion');
    } finally {
      setSaving(false);
    }
  };

  const selectedType = PROMO_TYPES.find(t => t.value === form.promo_type);
  const needsDiscount = ['percentage_discount', 'fixed_discount'].includes(form.promo_type);
  const needsCode = form.promo_type === 'coupon_code';

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-foreground">New Promotion</h3>
        <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground text-sm">Cancel</button>
      </div>

      {/* Type picker */}
      <div className="space-y-1.5">
        <Label>Promotion Type *</Label>
        <div className="grid grid-cols-2 gap-2">
          {PROMO_TYPES.map(type => {
            const Icon = type.icon;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => set('promo_type', type.value)}
                className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
                  form.promo_type === type.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${form.promo_type === type.value ? 'text-primary' : 'text-muted-foreground'}`} />
                <div>
                  <p className={`text-xs font-semibold ${form.promo_type === type.value ? 'text-primary' : 'text-foreground'}`}>{type.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{type.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Promotion Title *</Label>
        <Input required value={form.title} onChange={e => set('title', e.target.value)}
          placeholder={form.promo_type === 'happy_hour' ? 'e.g. Terrific Wednesdays — 15% off!' : 'e.g. Weekend Special'}
          className="rounded-xl" />
      </div>

      <div className="space-y-1.5">
        <Label>Description (shown to customers)</Label>
        <Textarea value={form.description} onChange={e => set('description', e.target.value)}
          placeholder="Tell customers what this deal is about..."
          className="rounded-xl h-16 resize-none" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {needsDiscount && (
          <div className="space-y-1.5">
            <Label>{form.promo_type === 'percentage_discount' ? 'Discount %' : 'Discount $'}</Label>
            <Input type="number" min="0" step="0.5" value={form.discount_value}
              onChange={e => set('discount_value', e.target.value)}
              placeholder={form.promo_type === 'percentage_discount' ? '20' : '2.00'}
              className="rounded-xl" />
          </div>
        )}
        {needsCode && (
          <div className="space-y-1.5 col-span-2">
            <Label>Coupon Code *</Label>
            <Input value={form.coupon_code} onChange={e => set('coupon_code', e.target.value.toUpperCase())}
              placeholder="e.g. SAVE20" className="rounded-xl font-mono" />
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Min Order ($)</Label>
          <Input type="number" min="0" step="0.5" value={form.min_order_amount}
            onChange={e => set('min_order_amount', e.target.value)}
            placeholder="0.00" className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>Max Uses</Label>
          <Input type="number" min="1" value={form.max_uses}
            onChange={e => set('max_uses', e.target.value)}
            placeholder="Unlimited" className="rounded-xl" />
        </div>
      </div>

      {/* Applicable days */}
      <div className="space-y-1.5">
        <Label>Active On</Label>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map(day => (
            <button key={day} type="button" onClick={() => toggleDay(day)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                form.applicable_days.includes(day)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}>
              {day.slice(0, 3)}
            </button>
          ))}
          <button type="button" onClick={() => set('applicable_days', form.applicable_days.length === 7 ? [] : [...DAYS])}
            className="px-3 py-1 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80">
            {form.applicable_days.length === 7 ? 'Clear' : 'All'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Start Date</Label>
          <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>End Date</Label>
          <Input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} className="rounded-xl" />
        </div>
      </div>

      <Button type="submit" disabled={saving} className="w-full rounded-xl">
        {saving ? 'Creating...' : 'Create Promotion'}
      </Button>
    </form>
  );
}

export default function PartnerPromotions({ shop }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: promos = [], isLoading } = useQuery({
    queryKey: ['partner-promos', shop?.id],
    queryFn: () => base44.entities.Promotion.filter({ shop_id: shop.id }, '-created_date', 50),
    enabled: !!shop?.id,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['partner-promos', shop?.id] });

  const togglePromo = async (promo) => {
    await base44.entities.Promotion.update(promo.id, { is_active: !promo.is_active });
    toast.success(promo.is_active ? 'Promotion deactivated' : 'Promotion activated');
    refresh();
  };

  const deletePromo = async (id) => {
    if (!confirm('Delete this promotion?')) return;
    await base44.entities.Promotion.delete(id);
    toast.success('Promotion deleted');
    refresh();
  };

  const active = promos.filter(p => p.is_active);
  const inactive = promos.filter(p => !p.is_active);

  if (isLoading) return <div className="animate-pulse space-y-3">{[1,2].map(i => <div key={i} className="h-24 bg-muted rounded-2xl" />)}</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Promotions</h1>
          <p className="text-muted-foreground text-sm">{active.length} active · {promos.length} total</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="rounded-xl" disabled={showForm}>
          <Plus className="w-4 h-4 mr-1" /> New Promo
        </Button>
      </div>

      {showForm && (
        <PromoForm
          shopId={shop.id}
          onSave={() => { setShowForm(false); refresh(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {promos.length === 0 && !showForm && (
        <div className="bg-card rounded-2xl border border-border p-12 text-center">
          <Tag className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="font-semibold text-foreground">No promotions yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create deals to attract more customers</p>
        </div>
      )}

      {active.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Active</h2>
          {active.map(promo => (
            <PromoCard key={promo.id} promo={promo} onToggle={togglePromo} onDelete={deletePromo} />
          ))}
        </div>
      )}

      {inactive.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Inactive</h2>
          {inactive.map(promo => (
            <PromoCard key={promo.id} promo={promo} onToggle={togglePromo} onDelete={deletePromo} />
          ))}
        </div>
      )}
    </div>
  );
}
