import React, { useState } from 'react';
import { Calendar, X, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ScheduledDelivery({ value, onChange }) {
  const [enabled, setEnabled] = useState(!!value);

  const minDateTime = () => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setSeconds(0, 0);
    return d.toISOString().slice(0, 16);
  };

  const maxDateTime = () => {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  };

  const formatDisplay = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-ZA', {
      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  };

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next);
    if (!next) onChange(null);
  };

  return (
    <div className="bg-card rounded-2xl border border-border/50 p-4">
      <button onClick={handleToggle} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${enabled ? 'bg-primary/10' : 'bg-muted'}`}>
            <Calendar className={`w-4 h-4 ${enabled ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm text-foreground">Schedule for Later</p>
            <p className="text-xs text-muted-foreground">
              {value ? formatDisplay(value) : 'Deliver as soon as possible'}
            </p>
          </div>
        </div>
        <div className={`w-11 h-6 rounded-full transition-colors relative ${enabled ? 'bg-primary' : 'bg-muted'}`}>
          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </div>
      </button>

      {enabled && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <div>
            <Label className="text-xs text-muted-foreground">Delivery Date & Time</Label>
            <Input type="datetime-local" min={minDateTime()} max={maxDateTime()}
              value={value || ''} onChange={e => onChange(e.target.value)}
              className="mt-1 rounded-xl bg-muted/50 border-0" />
          </div>
          {value && (
            <div className="flex items-center gap-2 bg-primary/5 rounded-xl px-3 py-2.5">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              <p className="text-xs text-primary font-medium flex-1">Scheduled for {formatDisplay(value)}</p>
              <button onClick={() => onChange(null)}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Must be at least 1 hour from now. Restaurant notified at the right time.</p>
        </div>
      )}
    </div>
  );
}
