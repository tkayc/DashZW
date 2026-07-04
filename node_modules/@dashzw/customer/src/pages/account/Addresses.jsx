import React, { useState } from 'react';
import { MapPinned, Plus, Home, Building2 } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const MOCK_ADDRESSES = [
  { id: 'home', label: 'Home', line: '12 Samora Machel Ave, Harare', instructions: 'Gate code 4421', isDefault: true },
  { id: 'work', label: 'Work', line: 'CBD Office Park', instructions: 'Reception, call on arrival', isDefault: false },
];

/**
 * Saved delivery addresses.
 * TODO(postgresql): customer_addresses table.
 */
export default function Addresses() {
  const [addresses] = useState(MOCK_ADDRESSES);
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="px-4 pt-6 pb-8 space-y-4">
      <PageHeader title="Addresses" subtitle="Delivery locations" />

      <div className="space-y-3">
        {addresses.map((a) => (
          <div key={a.id} className="bg-card rounded-2xl border border-border/50 p-4">
            <div className="flex items-start gap-3">
              {a.id === 'home' ? (
                <Home className="w-5 h-5 text-primary shrink-0" />
              ) : (
                <Building2 className="w-5 h-5 text-primary shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">{a.label}</p>
                  {a.isDefault && (
                    <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-lg">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{a.line}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{a.instructions}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAdd ? (
        <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-3">
          <Input placeholder="Label (Home, Work…)" className="rounded-xl" />
          <Input placeholder="Street address" className="rounded-xl" />
          <Textarea placeholder="Delivery instructions" className="rounded-xl" />
          <div className="flex gap-2">
            <Button
              className="flex-1 rounded-xl"
              onClick={() => {
                toast.message('Address save requires backend');
                setShowAdd(false);
              }}
            >
              Save
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="w-full rounded-xl" onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add address
        </Button>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex gap-2">
        <MapPinned className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">
          Addresses are mock data for now. Checkout still uses your profile address and GPS.
        </p>
      </div>
    </div>
  );
}
