import React, { useState } from 'react';
import { AlertTriangle, X, CheckCircle2, Loader2, Shield } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { base44, createNotification, invalidateCollection } from '@/api';
import { toast } from 'sonner';

async function saveIncident(incident) {
  await base44.entities.DriverIncident.create(incident);
  invalidateCollection('DriverIncident');
}

export default function DriverSafety({ activeOrder }) {
  const { user } = useAuth();
  const [showSOS, setShowSOS]       = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [sosCountdown, setSosCountdown] = useState(null);
  const [incidentType, setIncidentType] = useState('');
  const [incidentDesc, setIncidentDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);

  const triggerSOS = () => {
    let count = 5;
    setSosCountdown(count);
    const interval = setInterval(() => {
      count--;
      setSosCountdown(count);
      if (count <= 0) {
        clearInterval(interval);
        setSosCountdown(null);
        createNotification({
          recipient_email: 'admin@dashzw.com',
          title: '🆘 DRIVER SOS ALERT',
          body: `${user?.full_name} triggered SOS${activeOrder ? ` on order #${activeOrder.id.slice(-6)}` : ''}. Contact immediately.`,
          type: 'order_update', link: '/admin',
        });
        saveIncident({
          driver_email: user?.email,
          driver_name: user?.full_name,
          order_id: activeOrder?.id || null,
          type: 'SOS',
          description: 'Emergency SOS triggered.',
          status: 'open',
        }).catch(() => {});
        toast.error('🆘 SOS sent to admin. Stay safe.', { duration: 8000 });
        setShowSOS(false);
      }
    }, 1000);
    window._sosInterval = interval;
  };

  const cancelSOS = () => { clearInterval(window._sosInterval); setSosCountdown(null); };

  const submitReport = async () => {
    if (!incidentType) { toast.error('Select an incident type'); return; }
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 500));
    try {
      await saveIncident({
        driver_email: user?.email,
        driver_name: user?.full_name,
        order_id: activeOrder?.id || null,
        type: incidentType,
        description: incidentDesc,
        status: 'open',
      });
      createNotification({
        recipient_email: 'admin@dashzw.com',
        title: `⚠️ Incident: ${incidentType}`,
        body: `${user?.full_name}: ${incidentDesc || incidentType}`,
        type: 'order_update',
        link: '/admin',
      });
      setSubmitted(true);
      toast.success('Incident reported successfully.');
    } catch (e) {
      toast.error(e.message || 'Failed to report');
    } finally {
      setSubmitting(false);
    }
  };

  const TYPES = ['Road accident','Vehicle breakdown','Customer dispute','Unsafe area','Order tampering','Other'];

  return (
    <>
      <div className="flex gap-2 mt-3">
        <button onClick={() => setShowSOS(true)}
          className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white rounded-2xl py-2.5 font-semibold text-sm">
          <AlertTriangle className="w-4 h-4" /> SOS Emergency
        </button>
        <button onClick={() => { setShowReport(true); setSubmitted(false); setIncidentType(''); setIncidentDesc(''); }}
          className="flex-1 flex items-center justify-center gap-2 bg-orange-50 text-orange-700 border border-orange-200 rounded-2xl py-2.5 font-semibold text-sm">
          <Shield className="w-4 h-4" /> Report Incident
        </button>
      </div>

      {showSOS && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-card rounded-3xl p-6 w-full max-w-sm text-center border-2 border-red-500">
            <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-3" />
            <h2 className="text-xl font-black text-red-600 mb-2">EMERGENCY SOS</h2>
            <p className="text-sm text-muted-foreground mb-4">Immediately alerts DashZW admin with your location and order details.</p>
            {sosCountdown !== null ? (
              <>
                <div className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl font-black text-white">{sosCountdown}</span>
                </div>
                <p className="text-sm font-semibold text-red-600 mb-4">Sending in {sosCountdown}s…</p>
                <Button variant="outline" onClick={cancelSOS} className="w-full rounded-2xl">Cancel — I'm okay</Button>
              </>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowSOS(false)} className="flex-1 rounded-2xl">Cancel</Button>
                <Button onClick={triggerSOS} className="flex-1 rounded-2xl bg-red-600 hover:bg-red-700">Send SOS</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {showReport && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={() => setShowReport(false)}>
          <div className="bg-card w-full max-w-md rounded-t-3xl border border-border p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-foreground">Report Incident</p>
              <button onClick={() => setShowReport(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            {submitted ? (
              <div className="text-center py-6">
                <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
                <p className="font-bold text-foreground">Reported</p>
                <p className="text-sm text-muted-foreground mt-1">Admin will follow up with you shortly.</p>
                <Button variant="outline" onClick={() => setShowReport(false)} className="mt-4 rounded-xl">Close</Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Incident Type</p>
                  <div className="grid grid-cols-2 gap-2">
                    {TYPES.map(t => (
                      <button key={t} onClick={() => setIncidentType(t)}
                        className={`text-xs py-2 px-3 rounded-xl border text-left transition-colors ${incidentType === t ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>{t}</button>
                    ))}
                  </div>
                </div>
                <Textarea placeholder="Describe what happened…" value={incidentDesc} onChange={e => setIncidentDesc(e.target.value)} className="rounded-xl bg-muted/50 border-0 h-20" />
                <Button onClick={submitReport} disabled={submitting || !incidentType} className="w-full rounded-xl">
                  {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</> : 'Submit Report'}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
