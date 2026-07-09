import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { listPendingDrivers, setDriverVerification } from '@/api';
import { getApiBaseUrl } from '@/api';

function docUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path) || path.startsWith('data:')) return path;
  const base = getApiBaseUrl() || '';
  return `${base}${path}`;
}

export default function AdminDriverVerification() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [filter, setFilter] = useState('pending');

  const load = async () => {
    setLoading(true);
    try {
      const rows = await listPendingDrivers();
      setDrivers(rows || []);
    } catch (e) {
      toast.error(e.message || 'Could not load drivers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = drivers.filter((d) => {
    if (filter === 'all') return true;
    return (d.verification_status || 'pending') === filter;
  });

  const act = async (email, status) => {
    setBusy(email + status);
    try {
      await setDriverVerification(email, {
        status,
        reason: status === 'rejected' ? 'Please re-submit clearer document photos' : undefined,
      });
      toast.success(status === 'approved' ? 'Driver approved' : 'Driver rejected');
      await load();
    } catch (e) {
      toast.error(e.message || 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Driver verification</h1>
        <p className="text-sm text-muted-foreground">
          Review ID, licence, vehicle and profile photos. Approved drivers must still pass the road safety quiz.
        </p>
      </div>

      <div className="flex gap-2">
        {['pending', 'approved', 'rejected', 'all'].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize border ${
              filter === f ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-10 text-center text-sm text-muted-foreground">
          No drivers in this filter
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((d) => {
            const docs = d.documents || {};
            return (
              <div key={d.email} className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-foreground">{d.full_name || d.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.email} · {d.phone || 'no phone'} ·{' '}
                      <span className="capitalize">{d.vehicle_type || '—'}</span>
                    </p>
                    {d.date_of_birth && (
                      <p className="text-xs text-muted-foreground">DOB: {d.date_of_birth}</p>
                    )}
                  </div>
                  <Badge
                    className={
                      d.verification_status === 'approved'
                        ? 'bg-green-100 text-green-800'
                        : d.verification_status === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                    }
                  >
                    {d.verification_status || 'pending'}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    ['id_document', 'ID'],
                    ['drivers_license', 'Licence'],
                    ['vehicle_photo', 'Vehicle'],
                    ['profile_photo', 'Profile'],
                  ].map(([key, label]) => {
                    const url = docUrl(docs[key]);
                    return (
                      <a
                        key={key}
                        href={url || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className={`rounded-xl border overflow-hidden bg-muted/40 ${!url ? 'pointer-events-none opacity-40' : ''}`}
                      >
                        {url ? (
                          <img src={url} alt={label} className="w-full h-24 object-cover" />
                        ) : (
                          <div className="h-24 flex items-center justify-center text-xs text-muted-foreground">Missing</div>
                        )}
                        <p className="text-[10px] font-semibold px-2 py-1 flex items-center gap-1">
                          {label} {url && <ExternalLink className="w-3 h-3" />}
                        </p>
                      </a>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Quiz: {d.quiz_passed ? `Passed (${d.quiz_score ?? '—'}%)` : 'Not passed'}</span>
                  {d.account_active && <span className="text-green-700 font-semibold">· Active</span>}
                </div>

                {d.verification_status !== 'approved' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="rounded-xl flex-1"
                      disabled={!!busy}
                      onClick={() => act(d.email, 'approved')}
                    >
                      {busy === d.email + 'approved' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl flex-1 text-destructive"
                      disabled={!!busy}
                      onClick={() => act(d.email, 'rejected')}
                    >
                      {busy === d.email + 'rejected' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 mr-1" /> Reject
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
