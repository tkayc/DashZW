import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [phone, setPhone] = useState('');
  const [mode, setMode] = useState('email');
  const [loading, setLoading] = useState(false);
  const [resolvedEmail, setResolvedEmail] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResolvedEmail(null);
    try {
      const payload = mode === 'email' ? { email } : { phone };
      const result = await base44.auth.checkAccount(payload);
      if (result.available) {
        toast.error('No account found with those details');
        return;
      }
      setResolvedEmail(result.existingEmail);
      toast.success('Account found — choose a new password');
    } catch (err) {
      toast.error(err.message || 'Could not look up account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-2xl font-bold text-foreground mb-1">Forgot password</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Enter your email or phone to reset your password.
        </p>

        {resolvedEmail ? (
          <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-3">
            <p className="text-sm text-foreground">
              Account found for <span className="font-semibold">{resolvedEmail}</span>
            </p>
            <Button
              className="w-full rounded-xl"
              onClick={() =>
                navigate('/auth/reset-password', { state: { email: resolvedEmail } })
              }
            >
              Choose new password
            </Button>
          </div>
        ) : (
          <>
            <div className="flex bg-muted rounded-xl p-1 mb-4">
              <button
                type="button"
                onClick={() => setMode('email')}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold ${
                  mode === 'email' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'
                }`}
              >
                Email
              </button>
              <button
                type="button"
                onClick={() => setMode('phone')}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold ${
                  mode === 'phone' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'
                }`}
              >
                Phone
              </button>
            </div>
            <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-4">
              {mode === 'email' ? (
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Phone number</Label>
                  <Input
                    type="tel"
                    required
                    placeholder="+263 77x xxx xxx"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              )}
              <Button type="submit" disabled={loading} className="w-full rounded-xl h-11">
                {loading ? 'Looking up…' : 'Continue'}
              </Button>
            </form>
          </>
        )}

        <Link to="/login" className="block text-center text-sm text-primary mt-4 font-semibold">
          Back to login
        </Link>
      </div>
    </div>
  );
}
