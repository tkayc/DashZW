import React, { useState } from 'react';
import { Settings, Map, HardDrive, CreditCard, Flag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const SECTIONS = [
  {
    id: 'geo',
    title: 'Countries & languages',
    icon: Map,
    fields: [
      { key: 'countries', label: 'Countries', value: 'ZW, ZA' },
      { key: 'currencies', label: 'Currencies', value: 'USD, ZWG, ZAR' },
      { key: 'languages', label: 'Languages', value: 'en, sn, nd' },
    ],
  },
  {
    id: 'commerce',
    title: 'Taxes & fees',
    icon: Settings,
    fields: [
      { key: 'tax_rate', label: 'Tax rate %', value: '0' },
      { key: 'commission', label: 'Commission rates %', value: '5' },
      { key: 'delivery_fees', label: 'Base delivery fee', value: '2.50' },
      { key: 'surge', label: 'Surge pricing', value: 'Enabled (see dashboard)' },
    ],
  },
  {
    id: 'flags',
    title: 'Feature flags',
    icon: Flag,
    fields: [
      { key: 'guest_browse', label: 'Guest browsing', value: 'on' },
      { key: 'multi_merchant_cart', label: 'Multi-merchant cart', value: 'off' },
      { key: 'scheduled_delivery', label: 'Scheduled delivery', value: 'placeholder' },
      { key: 'biometric_login', label: 'Biometric login', value: 'placeholder' },
    ],
  },
  {
    id: 'payments',
    title: 'Payment providers',
    icon: CreditCard,
    fields: [
      { key: 'ecocash', label: 'EcoCash', value: 'placeholder' },
      { key: 'onemoney', label: 'OneMoney', value: 'placeholder' },
      { key: 'innbucks', label: 'InnBucks', value: 'placeholder' },
      { key: 'card', label: 'Card gateway', value: 'placeholder' },
    ],
  },
  {
    id: 'infra',
    title: 'Maps & storage',
    icon: HardDrive,
    fields: [
      { key: 'maps', label: 'Maps provider', value: 'placeholder (Leaflet demo)' },
      { key: 'storage', label: 'Object storage', value: 'placeholder (local/S3)' },
      { key: 'redis', label: 'Redis cache', value: 'placeholder' },
    ],
  },
];

/**
 * Platform settings — countries, currencies, languages, taxes, commissions,
 * delivery fees, surge, feature flags, payment/maps/storage placeholders.
 */
export default function PlatformSettings() {
  const [values, setValues] = useState(() => {
    const init = {};
    SECTIONS.forEach((s) => s.fields.forEach((f) => { init[f.key] = f.value; }));
    return init;
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Platform settings</h1>
        <p className="text-sm text-muted-foreground">
          Configuration placeholders — persisted settings require backend.
        </p>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.id} className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <div className="flex items-center gap-2">
            <section.icon className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground">{section.title}</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {section.fields.map((f) => (
              <div key={f.key}>
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                <Input
                  className="mt-1 rounded-xl"
                  value={values[f.key]}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <Button
        className="rounded-xl"
        onClick={() => toast.message('Settings save requires platform config API')}
      >
        Save configuration
      </Button>
      {/* TODO(backend): platform_config table · feature flags service */}
    </div>
  );
}
