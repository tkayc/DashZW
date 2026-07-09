import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Clock, CheckCircle2, XCircle, Shield, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDriverOnboardingStatus } from '@/api';
import { useAuth } from '@/lib/AuthContext';

export default function DriverOnboarding() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDriverOnboardingStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const verification = status?.verification_status || 'pending';
  const quizPassed = !!status?.quiz_passed;
  const active = !!status?.account_active;

  return (
    <div className="min-h-screen bg-background px-4 py-10 max-w-md mx-auto">
      <h1 className="text-xl font-bold text-foreground mb-1">Driver onboarding</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Hi {user?.full_name?.split(' ')[0] || 'there'} — finish these steps to start delivering.
      </p>

      <div className="space-y-3">
        <div className="bg-card border border-border rounded-2xl p-4 flex gap-3">
          <FileText className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">1. Documents submitted</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              ID, licence, vehicle photo and profile photo
            </p>
          </div>
          <CheckCircle2 className="w-5 h-5 text-green-600 ml-auto shrink-0" />
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 flex gap-3">
          {verification === 'approved' ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          ) : verification === 'rejected' ? (
            <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          ) : (
            <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold">2. Admin verification</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {verification === 'approved' && 'Your documents were approved.'}
              {verification === 'pending' &&
                'Usually takes 24–72 hours. We’ll notify you when it’s done.'}
              {verification === 'rejected' &&
                (status?.rejection_reason || 'Documents were rejected. Contact support or re-register.')}
            </p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 flex gap-3">
          {quizPassed ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          ) : (
            <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">3. Road safety quiz</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {quizPassed
                ? 'Passed — your account is active.'
                : verification === 'approved'
                  ? 'Complete the quiz to activate your account and accept jobs.'
                  : 'Available after your documents are approved.'}
            </p>
            {verification === 'approved' && !quizPassed && (
              <Button className="mt-3 rounded-xl" size="sm" onClick={() => navigate('/quiz')}>
                Take quiz
              </Button>
            )}
          </div>
        </div>
      </div>

      {active && (
        <Button className="w-full rounded-xl mt-6" onClick={() => navigate('/jobs')}>
          Go to available jobs
        </Button>
      )}

      <p className="text-center text-xs text-muted-foreground mt-8">
        <button type="button" onClick={logout} className="underline">
          Log out
        </button>
        {' · '}
        <Link to="/profile" className="underline">
          Profile
        </Link>
      </p>
    </div>
  );
}
