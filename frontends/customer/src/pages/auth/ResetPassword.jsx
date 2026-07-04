import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';

/** TODO(auth): POST /api/auth/reset-password with token. */
export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
    toast.success('Password updated (mock)');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <button type="button" onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-2xl font-bold text-foreground mb-1">Reset password</h1>
        <p className="text-sm text-muted-foreground mb-6">Choose a new password for your account.</p>
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="space-y-1.5">
            <Label>New password</Label>
            <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm password</Label>
            <Input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="rounded-xl" />
          </div>
          <Button type="submit" className="w-full rounded-xl h-11">
            Update password
          </Button>
        </form>
        <Link to="/login" className="block text-center text-sm text-primary mt-4 font-semibold">
          Back to login
        </Link>
      </div>
    </div>
  );
}
