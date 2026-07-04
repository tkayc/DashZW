import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from 'sonner';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { useSystemNotifications } from '@/hooks/usePushNotifications';
import ErrorBoundary from '@/components/ErrorBoundary';
import Login from '@/pages/Login';
import PartnerLayout from '@/pages/PartnerLayout';
import PartnerIndex from '@/pages/PartnerIndex';
import PartnerMenuPage from '@/pages/PartnerMenuPage';
import PartnerOrdersPage from '@/pages/PartnerOrdersPage';
import PartnerShopPage from '@/pages/PartnerShopPage';
import PartnerPromotionsPage from '@/pages/PartnerPromotionsPage';
import PartnerDriverTopUp from '@/pages/PartnerDriverTopUp';
import PartnerDriverWithdraw from '@/pages/PartnerDriverWithdraw';
import PartnerEarnings from '@/pages/PartnerEarnings';
import PartnerShopGate from '@/pages/PartnerShopGate';
import PartnerInventory from '@/pages/PartnerInventory';
import PartnerAnalytics from '@/pages/PartnerAnalytics';
import PartnerSection from '@/pages/PartnerSection';

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
      <Route element={<PartnerLayout />}>
        <Route path="/" element={<PartnerIndex />} />
        <Route path="/menu" element={<PartnerMenuPage />} />
        <Route
          path="/inventory"
          element={<PartnerShopGate>{(shop) => <PartnerInventory shop={shop} />}</PartnerShopGate>}
        />
        <Route
          path="/analytics"
          element={<PartnerShopGate>{(shop) => <PartnerAnalytics shop={shop} />}</PartnerShopGate>}
        />
        <Route
          path="/staff"
          element={<PartnerShopGate>{(shop) => <PartnerSection shop={shop} section="staff" />}</PartnerShopGate>}
        />
        <Route
          path="/branches"
          element={<PartnerShopGate>{(shop) => <PartnerSection shop={shop} section="branches" />}</PartnerShopGate>}
        />
        <Route
          path="/reviews"
          element={<PartnerShopGate>{(shop) => <PartnerSection shop={shop} section="reviews" />}</PartnerShopGate>}
        />
        <Route
          path="/customers"
          element={<PartnerShopGate>{(shop) => <PartnerSection shop={shop} section="customers" />}</PartnerShopGate>}
        />
        <Route
          path="/notifications"
          element={<PartnerShopGate>{(shop) => <PartnerSection shop={shop} section="notifications" />}</PartnerShopGate>}
        />
        <Route path="/orders" element={<PartnerOrdersPage />} />
        <Route path="/promotions" element={<PartnerPromotionsPage />} />
        <Route path="/shop" element={<PartnerShopPage />} />
        <Route path="/driver-topup" element={<PartnerDriverTopUp />} />
        <Route path="/driver-withdrawal" element={<PartnerDriverWithdraw />} />
        <Route path="/earnings" element={<PartnerEarnings />} />
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
