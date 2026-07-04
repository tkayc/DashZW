import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';

/** TODO(auth): POST /api/auth/forgot-password → email/SMS reset link. */
export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    await new Promise((r) => setTimeout(r, 500));
    setSent(true);
    toast.success('Reset link sent (mock)');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <button type="button" onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-2xl font-bold text-foreground mb-1">Forgot password</h1>
        <p className="text-sm text-muted-foreground mb-6">Enter your email and we&apos;ll send a reset link.</p>

        {sent ? (
          <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-3">
            <p className="text-sm text-foreground">Check your inbox for a reset link (mock).</p>
            <Button className="w-full rounded-xl" onClick={() => navigate('/auth/reset-password', { state: { email } })}>
              Continue to reset (demo)
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl" />
            </div>
            <Button type="submit" className="w-full rounded-xl h-11">
              Send reset link
            </Button>
          </form>
        )}
        <Link to="/login" className="block text-center text-sm text-primary mt-4 font-semibold">
          Back to login
        </Link>
      </div>
    </div>
  );
}
