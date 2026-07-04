import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, UtensilsCrossed, Store, Bike, User } from 'lucide-react';

const ROLES = [
  { id: 'customer', label: 'Customer',  icon: User,  desc: 'Order food delivered to you' },
  { id: 'partner',  label: 'Restaurant Partner', icon: Store, desc: 'List your restaurant & manage orders' },
  { id: 'driver',   label: 'Delivery Driver', icon: Bike,  desc: 'Earn by delivering orders' },
];

export default function SignUp() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [role, setRole]           = useState('customer');
  const [fullName, setFullName]   = useState('');
  const [email, setEmail]         = useState('');
  const [phone, setPhone]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [loading, setLoading]     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim())  { toast.error('Please enter your full name'); return; }
    if (!email.trim())     { toast.error('Please enter your email'); return; }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (password !== confirm) { toast.error('Passwords do not match'); return; }

    setLoading(true);
    try {
      const user = await register({ email, password, full_name: fullName, role, phone });
      toast.success('Account created! Welcome, ' + user.full_name);
      if (role === 'partner') {
        toast.info('Your restaurant account is pending admin approval.');
        navigate('/partner');
      } else if (role === 'driver') {
        navigate('/driver');
      } else {
        navigate('/');
      }
    } catch (err) {
      toast.error(err.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-3 shadow-lg">
            <UtensilsCrossed className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Create Account</h1>
          <p className="text-sm text-muted-foreground mt-1">Join DashZW today 🇿🇼</p>
        </div>

        {/* Role picker */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {ROLES.map(r => {
            const Icon = r.icon;
            return (
              <button key={r.id} type="button" onClick={() => setRole(r.id)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-center transition-all ${
                  role === r.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/50'
                }`}>
                <Icon className={`w-5 h-5 ${role === r.id ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`text-xs font-semibold leading-tight ${role === r.id ? 'text-primary' : 'text-foreground'}`}>
                  {r.label}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground text-center mb-5">
          {ROLES.find(r => r.id === role)?.desc}
          {role === 'partner' && <span className="text-yellow-600 font-medium"> — requires admin approval</span>}
        </p>

        <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <div className="space-y-1.5">
            <Label>{role === 'partner' ? 'Restaurant Name' : 'Full Name'}</Label>
            <Input placeholder={role === 'partner' ? "e.g. Mama's Kitchen" : 'Your full name'}
              value={fullName} onChange={e => setFullName(e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Phone (optional)</Label>
            <Input placeholder="+263 77x xxx xxx"
              value={phone} onChange={e => setPhone(e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input type="password" placeholder="Min 6 characters"
              value={password} onChange={e => setPassword(e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm Password</Label>
            <Input type="password" placeholder="Repeat password"
              value={confirm} onChange={e => setConfirm(e.target.value)} className="rounded-xl" />
          </div>
          <Button type="submit" disabled={loading} className="w-full rounded-xl h-11 font-semibold">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account…</> : 'Create Account'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-primary font-semibold">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
