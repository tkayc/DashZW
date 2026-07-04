import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, UtensilsCrossed, ChevronDown, ChevronUp } from 'lucide-react';
import { getDemoAccountsForRole } from '@/constants/demoAccounts';

/**
 * Shared login UI — pass role + portalTitle + signUpPath per app.
 */
export default function LoginPage({
  role,
  portalTitle = 'DashZW',
  portalSubtitle = 'Sign in to continue',
  signUpPath = null,
  icon: Icon = UtensilsCrossed,
}) {
  const navigate = useNavigate();
  const { login } = useAuth();
  const demoAccounts = getDemoAccountsForRole(role);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  const doLogin = async (em, pw) => {
    setLoading(true);
    try {
      const u = await login(em, pw);
      toast.success(`Welcome, ${u.full_name}!`);
      navigate('/');
    } catch (err) {
      toast.error(err.message || 'Login failed. Is the API running on port 3001?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-3 shadow-lg">
            <Icon className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{portalTitle}</h1>
          <p className="text-sm text-muted-foreground mt-1">{portalSubtitle}</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            doLogin(email, password);
          }}
          className="bg-card rounded-2xl border border-border p-6 space-y-4 mb-4"
        >
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl"
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-xl"
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full rounded-xl h-11 font-semibold">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Signing in…
              </>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>

        {signUpPath && (
          <p className="text-center text-sm text-muted-foreground mb-4">
            No account?{' '}
            <Link to={signUpPath} className="text-primary font-semibold">
              Create one
            </Link>
          </p>
        )}

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
