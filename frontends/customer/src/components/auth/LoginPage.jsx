import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Mail, Phone, Fingerprint, ChevronDown, ChevronUp } from 'lucide-react';
import { getDemoAccountsForRole } from '@/constants/demoAccounts';
import DashZWLogo from '@shared/components/DashZWLogo.jsx';

/**
 * Customer auth entry — email/phone, social placeholders, guest, remember me.
 * TODO(auth): Wire phone OTP, OAuth, WebAuthn to backend.
 */
export default function LoginPage({
  role = 'customer',
  portalTitle = 'DashZW',
  portalSubtitle = 'Sign in to continue',
  signUpPath = '/signup',
}) {
  const navigate = useNavigate();
  const { login, enterGuestMode, loginWithProvider } = useAuth();
  const demoAccounts = getDemoAccountsForRole(role);

  const [mode, setMode] = useState('email'); // email | phone
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  const doLogin = async (em, pw) => {
    setLoading(true);
    try {
      const u = await login(em, pw, { rememberMe });
      toast.success(`Welcome, ${u.full_name}!`);
      navigate('/');
    } catch (err) {
      toast.error(err.message || 'Login failed. Is the API running on port 3001?');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === 'phone') {
      if (!phone.trim()) {
        toast.error('Enter your phone number');
        return;
      }
      navigate('/auth/otp', { state: { phone: phone.trim(), purpose: 'login' } });
      return;
    }
    doLogin(email, password);
  };

  const handleProvider = async (provider) => {
    try {
      await loginWithProvider(provider);
    } catch (err) {
      toast.message(`${provider} login`, { description: err.message });
    }
  };

  const handleGuest = () => {
    enterGuestMode();
    toast.success('Browsing as guest');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-3 shadow-lg text-primary-foreground">
            <DashZWLogo className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{portalTitle}</h1>
          <p className="text-sm text-muted-foreground mt-1">{portalSubtitle}</p>
        </div>

        <div className="flex bg-muted rounded-xl p-1 mb-4">
          <button
            type="button"
            onClick={() => setMode('email')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold ${
              mode === 'email' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'
            }`}
          >
            <Mail className="w-3.5 h-3.5" /> Email
          </button>
          <button
            type="button"
            onClick={() => setMode('phone')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold ${
              mode === 'phone' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'
            }`}
          >
            <Phone className="w-3.5 h-3.5" /> Phone
          </button>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border p-6 space-y-4 mb-4">
          {mode === 'email' ? (
            <>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <Label>Password</Label>
                  <Link to="/auth/forgot-password" className="text-xs text-primary font-medium">
                    Forgot password?
                  </Link>
                </div>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-xl"
                  autoComplete="current-password"
                  required
                />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label>Phone number</Label>
              <Input
                type="tel"
                placeholder="+263 7X XXX XXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="rounded-xl"
              />
              <p className="text-[10px] text-muted-foreground">We&apos;ll send a one-time code (OTP UI).</p>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded"
            />
            Remember me
          </label>

          <Button type="submit" disabled={loading} className="w-full rounded-xl h-11 font-semibold">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Signing in…
              </>
            ) : mode === 'phone' ? (
              'Continue with OTP'
            ) : (
              'Sign In'
            )}
          </Button>
        </form>

        <div className="space-y-2 mb-4">
          <p className="text-center text-[10px] text-muted-foreground uppercase tracking-wide">Or continue with</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleProvider('Google')}
              className="py-2.5 rounded-xl border border-border text-xs font-semibold hover:bg-muted/50"
            >
              Google
            </button>
            <button
              type="button"
              onClick={() => handleProvider('Apple')}
              className="py-2.5 rounded-xl border border-border text-xs font-semibold hover:bg-muted/50"
            >
              Apple
            </button>
            <button
              type="button"
              onClick={() => handleProvider('Biometric')}
              className="py-2.5 rounded-xl border border-border text-xs font-semibold hover:bg-muted/50 flex items-center justify-center gap-1"
            >
              <Fingerprint className="w-3.5 h-3.5" /> Bio
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGuest}
          className="w-full py-3 rounded-2xl border border-dashed border-border text-sm font-semibold text-muted-foreground hover:bg-muted/40 mb-4"
        >
          Continue as guest
        </button>

        {signUpPath && (
          <p className="text-center text-sm text-muted-foreground mb-4">
            No account?{' '}
            <Link to={signUpPath} className="text-primary font-semibold">
              Create one
            </Link>
          </p>
        )}

        <Link
          to="/auth/verify-email"
          className="block text-center text-xs text-muted-foreground mb-4 hover:text-primary"
        >
          Resend email verification
        </Link>

        {demoAccounts.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowDemo((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 rounded-2xl text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              <span className="font-medium">Demo accounts ({role})</span>
              {showDemo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showDemo && (
              <div className="mt-2 bg-card border border-border rounded-2xl overflow-hidden">
                {demoAccounts.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => doLogin(acc.email, acc.password)}
                    disabled={loading}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b border-border last:border-0 disabled:opacity-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{acc.label}</p>
                      <p className="text-xs text-muted-foreground">{acc.email}</p>
                    </div>
                    <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded-lg text-muted-foreground shrink-0 ml-2">
                      {acc.password}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
