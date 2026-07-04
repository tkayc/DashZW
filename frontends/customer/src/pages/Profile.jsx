import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import {
  User, Mail, LogOut, Heart, HelpCircle, Shield, Wallet, ArrowDownLeft, ChevronRight,
  CreditCard, Star, Gift, Building2, Users, MapPinned, Sparkles, CalendarClock,
  Bell, Lock, Languages, Info, ClipboardList, Trash2, Moon, Sun,
} from 'lucide-react';
import { useTheme } from '@/lib/ThemeContext';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { getCollectionSync, getCollection, getPoints, generateReferralCode } from '@/api';
import { requestNotificationPermission } from '@/hooks/usePushNotifications';
import { useRealtimeQuery as useQuery } from '@/api';
import { toast } from 'sonner';

function getCustomerWalletBalance(email) {
  if (!email) return 0;
  const wallets = getCollectionSync('Wallet');
  const w = wallets.find((x) => x.owner_email === email && x.owner_type === 'customer');
  return w ? w.balance : 0;
}

async function getCustomerTransactions(email) {
  if (!email) return [];
  const txs = await getCollection('Transaction');
  return txs
    .filter((t) => t.owner_email === email && t.owner_type === 'customer')
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
}

const MENU_SECTIONS = [
  {
    title: 'Account',
    items: [
      { icon: ClipboardList, label: 'Orders', path: '/orders', desc: 'Active & past orders' },
      { icon: Wallet, label: 'Wallet', path: '/wallet', desc: 'Balance & refunds' },
      { icon: CreditCard, label: 'Payment methods', path: '/payments', desc: 'Saved ways to pay' },
      { icon: MapPinned, label: 'Addresses', path: '/addresses', desc: 'Saved delivery locations' },
      { icon: Heart, label: 'Favourites', path: '/favourites', desc: 'Saved merchants' },
    ],
  },
  {
    title: 'Orders & rewards',
    items: [
      { icon: CalendarClock, label: 'Scheduled orders', path: '/scheduled', desc: 'Plan ahead' },
      { icon: Star, label: 'Rewards', path: '/loyalty', desc: 'Points, cashback & loyalty' },
      { icon: Gift, label: 'Gift cards', path: '/gift-cards', desc: 'Buy & redeem' },
      { icon: Users, label: 'Group orders', path: '/group-orders', desc: 'Order together' },
      { icon: Sparkles, label: 'For you', path: '/recommendations', desc: 'Personalised picks' },
    ],
  },
  {
    title: 'Preferences',
    items: [
      { icon: Bell, label: 'Notifications', path: '/settings/notifications', desc: 'Push & alerts' },
      { icon: Lock, label: 'Security', path: '/settings/security', desc: 'Password & 2FA' },
      { icon: Languages, label: 'Language', path: '/settings/language', desc: 'App language' },
    ],
  },
  {
    title: 'Work & support',
    items: [
      { icon: Building2, label: 'Corporate accounts', path: '/corporate', desc: 'Business billing' },
      { icon: HelpCircle, label: 'Help', path: '/help', desc: 'FAQs & tickets' },
      { icon: Shield, label: 'Privacy', path: '/privacy', desc: 'Your data' },
      { icon: Info, label: 'About', path: '/about', desc: 'App info' },
      { icon: Trash2, label: 'Delete account', path: '/settings/delete-account', desc: 'Close your account' },
    ],
  },
];

export default function Profile() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const { data: txs = [] } = useQuery({
    queryKey: ['customer-txs', user?.email],
    queryFn: () => getCustomerTransactions(user?.email),
    enabled: !!user?.email,
  });

  const { data: loyalty = { points: 0 } } = useQuery({
    queryKey: ['loyalty', user?.email],
    queryFn: () => getPoints(user.email),
    enabled: !!user?.email,
  });

  const { data: referralCode = '' } = useQuery({
    queryKey: ['referral', user?.email],
    queryFn: () => generateReferralCode(user.email),
    enabled: !!user?.email,
  });

  const walletBalance = getCustomerWalletBalance(user?.email);
  const pts = loyalty.points ?? 0;

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Profile</h1>

      <div className="bg-card rounded-2xl p-5 border border-border/50">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-foreground">{user?.full_name || 'User'}</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Mail className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{user?.email}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet summary → full page */}
      <Link
        to="/wallet"
        className="block bg-card rounded-2xl border border-border/50 overflow-hidden hover:bg-muted/30 transition-colors"
      >
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">DashZW Wallet</p>
              <p className="text-xs text-muted-foreground">Tap for full history</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <p className={`text-lg font-bold ${walletBalance > 0 ? 'text-green-700' : 'text-foreground'}`}>
              R{walletBalance.toFixed(2)}
            </p>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
        {txs.length > 0 && (
          <>
            <Separator />
            {txs.slice(0, 2).map((tx, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 border-t border-border/50">
                <div className="flex items-center gap-2.5 min-w-0">
                  <ArrowDownLeft className="w-3.5 h-3.5 text-green-600 shrink-0" />
                  <p className="text-xs text-foreground line-clamp-1">{tx.reason}</p>
                </div>
                <span className="text-xs font-bold text-green-700 shrink-0">
                  +R{Math.abs(tx.amount).toFixed(2)}
                </span>
              </div>
            ))}
          </>
        )}
      </Link>

      {/* Loyalty teaser */}
      <Link
        to="/loyalty"
        className="block bg-card rounded-2xl border border-border/50 p-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center justify-between mb-1">
          <p className="font-semibold text-sm text-foreground">⭐ Loyalty Points</p>
          <div className="flex items-center gap-1">
            <p className="text-lg font-bold text-primary">{pts} pts</p>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">View rewards & redeem</p>
      </Link>

      {/* Referral */}
      <div className="bg-card rounded-2xl border border-border/50 p-4">
        <p className="font-semibold text-sm text-foreground mb-1">👥 Refer a Friend</p>
        <p className="text-xs text-muted-foreground mb-2">Share your code. Both get R10 when they order.</p>
        <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
          <code className="text-sm font-mono font-bold text-primary flex-1">{referralCode || '…'}</code>
          <button
            type="button"
            onClick={() => {
              if (referralCode) {
                navigator.clipboard?.writeText(referralCode);
                toast.success('Code copied!');
              }
            }}
            className="text-xs text-primary font-medium"
          >
            Copy
          </button>
        </div>
        {/* TODO(backend): Apply referral code on signup / first order */}
      </div>

      {/* Account feature menus */}
      {MENU_SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
            {section.title}
          </p>
          <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
            {section.items.map((item, idx) => (
              <React.Fragment key={item.path}>
                <Link
                  to={item.path}
                  className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left"
                >
                  <item.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </Link>
                {idx < section.items.length - 1 && <Separator />}
              </React.Fragment>
            ))}
          </div>
        </div>
      ))}

      {typeof Notification !== 'undefined' && Notification.permission !== 'granted' && (
        <button
          type="button"
          onClick={async () => {
            const perm = await requestNotificationPermission();
            toast.success(perm === 'granted' ? '🔔 Notifications enabled!' : 'Notifications denied');
          }}
          className="w-full flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl p-4 text-left hover:bg-blue-100 transition-colors"
        >
          <span className="text-2xl">🔔</span>
          <div>
            <p className="font-semibold text-sm text-blue-800">Enable Push Notifications</p>
            <p className="text-xs text-blue-600 mt-0.5">Get notified when your order is on its way</p>
          </div>
        </button>
      )}

      <Button
        variant="outline"
        onClick={toggleTheme}
        className="w-full rounded-xl h-11"
        aria-label="Toggle dark mode"
      >
        {theme === 'dark' ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
        {theme === 'dark' ? 'Light mode' : 'Dark mode'}
      </Button>

      <Button
        variant="outline"
        onClick={logout}
        className="w-full rounded-xl h-11 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <LogOut className="w-4 h-4 mr-2" />
        Sign Out
      </Button>

      <p className="text-center text-xs text-muted-foreground mt-2">DashZW v1.0 — Made in Zimbabwe</p>
    </div>
  );
}
