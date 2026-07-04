import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';

/**
 * OTP verification UI (phone login / password reset).
 * TODO(auth): Verify OTP via backend SMS provider.
 */
export default function OtpVerification() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const phone = state?.phone || '';
  const purpose = state?.purpose || 'login';
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (code.length < 4) {
      toast.error('Enter the 4–6 digit code');
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    setLoading(false);
    // Mock: accept 1234
    if (code === '1234') {
      toast.success('Code verified (mock)');
      if (purpose === 'reset') navigate('/auth/reset-password', { state: { phone } });
      else navigate('/login');
    } else {
      toast.error('Invalid code. Try 1234 for demo.');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <button type="button" onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-2xl font-bold text-foreground mb-1">Enter OTP</h1>
        <p className="text-sm text-muted-foreground mb-6">
          We sent a code to {phone || 'your phone'} (mock — use <strong>1234</strong>).
        </p>
        <form onSubmit={handleVerify} className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="1234"
            className="text-center text-2xl tracking-widest font-bold rounded-xl h-14"
            maxLength={6}
          />
          <Button type="submit" disabled={loading} className="w-full rounded-xl h-11">
            {loading ? 'Verifying…' : 'Verify'}
          </Button>
          <button type="button" className="w-full text-xs text-primary font-medium" onClick={() => toast.message('OTP resent (mock)')}>
            Resend code
          </button>
        </form>
        <p className="text-[10px] text-muted-foreground text-center mt-4">
          SMS delivery is a placeholder. {/* TODO(auth): SMS gateway */}
        </p>
        <Link to="/login" className="block text-center text-sm text-primary mt-4 font-semibold">
          Back to login
        </Link>
      </div>
    </div>
  );
}
