import React, { useEffect, useState } from 'react';
import { MapPinned, Plus, Home, Building2, Pencil, Trash2, Star } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { locationApi, createAddressService } from '@/api/location';
import { useDeliveryLocation } from '@/lib/LocationContext';
import PlatformMap from '@location/components/PlatformMap.jsx';
import { getCurrentPosition } from '@location/services/PermissionService.js';

const EMPTY_FORM = {
  address_name: 'Home',
  street_address: '',
  suburb: '',
  city: 'Johannesburg',
  province: 'Gauteng',
  country: 'South Africa',
  postal_code: '',
  building_name: '',
  apartment_number: '',
  floor: '',
  delivery_instructions: '',
  phone_number: '',
  recipient_name: '',
  lat: null,
  lng: null,
  is_default: false,
};

export default function Addresses() {
  const { selectAddress } = useDeliveryLocation();
  const addressService = createAddressService(locationApi);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setAddresses(await addressService.list());
    } catch (e) {
      toast.error(e.message || 'Could not load addresses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const openCreate = () => setForm({ ...EMPTY_FORM });
  const openEdit = (a) => setForm({ ...EMPTY_FORM, ...a, address_name: a.address_name || a.label });

  const saveForm = async () => {
    if (!form?.street_address?.trim()) {
      toast.error('Street address is required');
      return;
    }
    setSaving(true);
    try {
      if (form.id) await addressService.update(form.id, form);
      else await addressService.create(form);
      toast.success('Address saved');
      setForm(null);
      await load();
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const useGps = async () => {
    try {
      const pos = await getCurrentPosition();
      const geo = await locationApi.reverseGeocode(pos.lat, pos.lng);
      setForm((f) => ({
        ...f,
        lat: pos.lat,
        lng: pos.lng,
        street_address: geo?.street_address || f?.street_address,
        suburb: geo?.suburb || f?.suburb,
        city: geo?.city || f?.city,
        province: geo?.province || f?.province,
        country: geo?.country || f?.country,
        postal_code: geo?.postal_code || f?.postal_code,
      }));
      toast.success('Location pinned');
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="px-4 pt-6 pb-8 space-y-4">
      <PageHeader title="Addresses" subtitle="Saved delivery locations" />

      {loading ? (
        <div className="h-24 bg-muted rounded-2xl animate-pulse" />
      ) : (
        <div className="space-y-3">
          {addresses.map((a) => (
            <div key={a.id} className="bg-card rounded-2xl border border-border/50 p-4">
              <div className="flex items-start gap-3">
                {a.address_name === 'Home' ? (
                  <Home className="w-5 h-5 text-primary shrink-0" />
                ) : (
                  <Building2 className="w-5 h-5 text-primary shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{a.address_name || a.label}</p>
                    {a.is_default && (
                      <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-lg">Default</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.formatted_address || a.street_address}</p>
                  {a.delivery_instructions && (
                    <p className="text-[11px] text-muted-foreground mt-1">{a.delivery_instructions}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button type="button" onClick={() => { selectAddress(a); toast.success('Delivery address updated'); }} title="Use for delivery">
                    <Star className="w-4 h-4 text-primary" />
                  </button>
                  <button type="button" onClick={() => openEdit(a)}><Pencil className="w-4 h-4 text-muted-foreground" /></button>
                  <button
                    type="button"
                    onClick={async () => {
                      await addressService.remove(a.id);
                      toast.success('Address removed');
                      load();
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {form ? (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Address name</Label><Input value={form.address_name} onChange={(e) => set('address_name', e.target.value)} className="rounded-xl" /></div>
            <div className="space-y-1"><Label>Recipient</Label><Input value={form.recipient_name} onChange={(e) => set('recipient_name', e.target.value)} className="rounded-xl" /></div>
          </div>
          <div className="space-y-1"><Label>Street address</Label><Input value={form.street_address} onChange={(e) => set('street_address', e.target.value)} className="rounded-xl" required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Suburb</Label><Input value={form.suburb} onChange={(e) => set('suburb', e.target.value)} className="rounded-xl" /></div>
            <div className="space-y-1"><Label>City</Label><Input value={form.city} onChange={(e) => set('city', e.target.value)} className="rounded-xl" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Province</Label><Input value={form.province} onChange={(e) => set('province', e.target.value)} className="rounded-xl" /></div>
            <div className="space-y-1"><Label>Postal code</Label><Input value={form.postal_code} onChange={(e) => set('postal_code', e.target.value)} className="rounded-xl" /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1"><Label>Building</Label><Input value={form.building_name} onChange={(e) => set('building_name', e.target.value)} className="rounded-xl" /></div>
            <div className="space-y-1"><Label>Apt</Label><Input value={form.apartment_number} onChange={(e) => set('apartment_number', e.target.value)} className="rounded-xl" /></div>
            <div className="space-y-1"><Label>Floor</Label><Input value={form.floor} onChange={(e) => set('floor', e.target.value)} className="rounded-xl" /></div>
          </div>
          <div className="space-y-1"><Label>Phone</Label><Input value={form.phone_number} onChange={(e) => set('phone_number', e.target.value)} className="rounded-xl" /></div>
          <div className="space-y-1"><Label>Delivery instructions</Label><Textarea value={form.delivery_instructions} onChange={(e) => set('delivery_instructions', e.target.value)} className="rounded-xl" rows={2} /></div>

          <PlatformMap
            height={180}
            center={form.lat && form.lng ? { lat: form.lat, lng: form.lng } : { lat: -26.1823, lng: 27.9985 }}
            customer={form.lat ? { lat: form.lat, lng: form.lng, label: 'Pinned location' } : null}
            onMapClick={({ lat, lng }) => setForm((f) => ({ ...f, lat, lng }))}
            showControls
          />
          <Button type="button" variant="outline" className="w-full rounded-xl" onClick={useGps}>
            <MapPinned className="w-4 h-4 mr-2" /> Save current location
          </Button>

          <div className="flex gap-2">
            <Button className="flex-1 rounded-xl" disabled={saving} onClick={saveForm}>{saving ? 'Saving…' : 'Save address'}</Button>
            <Button variant="outline" className="rounded-xl" onClick={() => setForm(null)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="w-full rounded-xl" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Add address
        </Button>
      )}
    </div>
  );
}
