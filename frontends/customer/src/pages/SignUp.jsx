import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, User, AlertCircle } from 'lucide-react';

export default function SignUp() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [existingAccount, setExistingAccount] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setExistingAccount(null);

    if (!fullName.trim()) {
      toast.error('Please enter your full name');
      return;
    }
    if (!email.trim()) {
      toast.error('Please enter your email');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const user = await register({ email, password, full_name: fullName, phone });
      toast.success(`Welcome, ${user.full_name}!`);
      navigate('/');
    } catch (err) {
      if (err.code === 'ACCOUNT_EXISTS') {
        setExistingAccount({
          field: err.field,
          email: err.existingEmail || email,
          message: err.message,
        });
      } else {
        toast.error(err.message || 'Sign up failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetEmail = existingAccount?.email || email;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-3 shadow-lg">
            <User className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Create customer account</h1>
          <p className="text-sm text-muted-foreground mt-1">Order from restaurants, shops & more</p>
        </div>

        {existingAccount && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
            <div className="flex gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900">Account already exists</p>
                <p className="text-xs text-amber-800 mt-1">
                  {existingAccount.field === 'phone'
                    ? 'This phone number is already linked to an account.'
                    : 'This email is already registered.'}
                  {' '}Sign in or reset your password.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-xl h-9 text-xs"
                onClick={() => navigate('/login')}
              >
                Sign in
              </Button>
              <Button
                type="button"
                className="flex-1 rounded-xl h-9 text-xs"
                onClick={() =>
                  navigate('/auth/reset-password', {
                    state: { email: resetEmail },
                  })
                }
              >
                Reset password
              </Button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input
              placeholder="Your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="rounded-xl"
              autoComplete="name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setExistingAccount(null);
              }}
              className="rounded-xl"
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Phone (optional)</Label>
            <Input
              type="tel"
              placeholder="+263 77x xxx xxx"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setExistingAccount(null);
              }}
              className="rounded-xl"
              autoComplete="tel"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input
              type="password"
              placeholder="Min 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-xl"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm password</Label>
            <Input
              type="password"
              placeholder="Repeat password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="rounded-xl"
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full rounded-xl h-11 font-semibold">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating account…
              </>
            ) : (
              'Create account'
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-primary font-semibold">
            Sign in
          </Link>
        </p>
        <p className="text-center text-xs text-muted-foreground mt-2">
          Merchants and drivers should use their dedicated portals to register.
        </p>
      </div>
    </div>
  );
}
