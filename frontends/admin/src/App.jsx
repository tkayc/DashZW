import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from 'sonner';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { useSystemNotifications } from '@/hooks/usePushNotifications';
import ErrorBoundary from '@/components/ErrorBoundary';
import Login from '@/pages/Login';
import AdminLayout from '@/pages/AdminLayout';
import AdminDashboard from '@/pages/AdminDashboard';
import AdminUsers from '@/pages/AdminUsers';
import AdminSection from '@/pages/AdminSection';
import PlatformSettings from '@/pages/PlatformSettings';

const SECTIONS = [
  'customers', 'drivers', 'merchants', 'orders', 'support', 'refunds',
  'disputes', 'reports', 'analytics', 'commissions', 'settlements',
  'coupons', 'notifications', 'audit', 'monitoring', 'roles',
];

function AppRoutes() {
  const { isLoadingAuth, isAuthenticated, user } = useAuth();
  useSystemNotifications(user?.email);

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route path="/" element={<AdminDashboard />} />
        <Route path="/users" element={<AdminUsers />} />
        <Route path="/settings" element={<PlatformSettings />} />
        {SECTIONS.map((s) => (
          <Route key={s} path={`/${s}`} element={<AdminSection section={s} />} />
        ))}
      </Route>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AppRoutes />
          </Router>
          <Toaster />
          <Sonner richColors position="top-center" />
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
