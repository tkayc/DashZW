import React, { useState } from 'react';
import { MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LocationPermissionDialog({ open, onAllow, onDeny, onManual }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-card w-full max-w-sm rounded-3xl border border-border shadow-2xl p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <MapPin className="w-6 h-6 text-primary" />
          </div>
          <button type="button" onClick={onDeny} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Enable location</h2>
          <p className="text-sm text-muted-foreground mt-1">
            We use your location to show nearby merchants, accurate delivery fees, and live order tracking.
          </p>
        </div>
        <div className="space-y-2">
          <Button className="w-full rounded-xl" onClick={onAllow}>Allow location access</Button>
          <Button variant="outline" className="w-full rounded-xl" onClick={onManual}>Enter address manually</Button>
          <Button variant="ghost" className="w-full rounded-xl text-muted-foreground" onClick={onDeny}>Not now</Button>
        </div>
      </div>
    </div>
  );
}
