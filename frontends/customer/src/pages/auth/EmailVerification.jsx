import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';

/** TODO(auth): Send / verify email tokens via backend. */
export default function EmailVerification() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Mail className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Verify your email</h1>
        <p className="text-sm text-muted-foreground mb-6">
          We&apos;ll send a verification link. This is a placeholder until email delivery is connected.
        </p>
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4 text-left">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl" placeholder="you@example.com" />
          </div>
          <Button
            className="w-full rounded-xl"
            onClick={() => {
              toast.success('Verification email sent (mock)');
              navigate('/login');
            }}
          >
            Send verification email
          </Button>
        </div>
        <Link to="/login" className="block text-sm text-primary mt-4 font-semibold">
          Back to login
        </Link>
      </div>
    </div>
  );
}
