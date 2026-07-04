import React, { Suspense, lazy } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from 'sonner';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { CartProvider } from '@/lib/CartContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import { useSystemNotifications } from '@/hooks/usePushNotifications';
import ErrorBoundary from '@/components/ErrorBoundary';
import { CustomerAppGuard, RoleGuard } from '@/components/auth/RoleGuard';
import { PERMISSIONS } from '@/domain/permissions';
import AppLayout from '@/components/layout/AppLayout';
import Login from '@/pages/Login';
import Home from '@/pages/Home';

// Lazy-loaded routes for production performance
const SignUp = lazy(() => import('@/pages/SignUp'));
const ShopDetail = lazy(() => import('@/pages/ShopDetail'));
const Cart = lazy(() => import('@/pages/Cart'));
const Checkout = lazy(() => import('@/pages/Checkout'));
const Orders = lazy(() => import('@/pages/Orders'));
const OrderDetail = lazy(() => import('@/pages/OrderDetail'));
const OrderConfirmation = lazy(() => import('@/pages/OrderConfirmation'));
const Profile = lazy(() => import('@/pages/Profile'));
const Search = lazy(() => import('@/pages/Search'));
const Explore = lazy(() => import('@/pages/Explore'));
const CustomerWallet = lazy(() => import('@/pages/CustomerWallet'));
const Favourites = lazy(() => import('@/pages/account/Favourites'));
const HelpSupport = lazy(() => import('@/pages/account/HelpSupport'));
const PrivacyPolicy = lazy(() => import('@/pages/account/PrivacyPolicy'));
const PaymentMethods = lazy(() => import('@/pages/account/PaymentMethods'));
const Loyalty = lazy(() => import('@/pages/account/Loyalty'));
const GiftCards = lazy(() => import('@/pages/account/GiftCards'));
const CorporateAccounts = lazy(() => import('@/pages/account/CorporateAccounts'));
const GroupOrders = lazy(() => import('@/pages/account/GroupOrders'));
const Addresses = lazy(() => import('@/pages/account/Addresses'));
const Recommendations = lazy(() => import('@/pages/account/Recommendations'));
const ScheduledOrders = lazy(() => import('@/pages/account/ScheduledOrders'));
const ProductDetail = lazy(() => import('@/pages/ProductDetail'));
const NotificationsSettings = lazy(() => import('@/pages/account/NotificationsSettings'));
const Security = lazy(() => import('@/pages/account/Security'));
const Language = lazy(() => import('@/pages/account/Language'));
const About = lazy(() => import('@/pages/account/About'));
const DeleteAccount = lazy(() => import('@/pages/account/DeleteAccount'));
const OtpVerification = lazy(() => import('@/pages/auth/OtpVerification'));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'));
const EmailVerification = lazy(() => import('@/pages/auth/EmailVerification'));
const Deals = lazy(() => import('@/pages/Deals'));
const NotificationCentre = lazy(() => import('@/pages/NotificationCentre'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20" role="status" aria-label="Loading">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );
}

function RequireAuth({ children }) {
  const { isAuthenticated, isGuest } = useAuth();
  if (!isAuthenticated && !isGuest) return <Navigate to="/login" replace />;
  if (isGuest) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { isLoadingAuth, isAuthenticated, isGuest, user } = useAuth();
  useSystemNotifications(user?.email);

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const canBrowse = isAuthenticated || isGuest;

  if (!canBrowse) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/auth/otp" element={<OtpVerification />} />
          <Route path="/auth/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
          <Route path="/auth/verify-email" element={<EmailVerification />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <CustomerAppGuard>
      <CartProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
            <Route path="/signup" element={isAuthenticated ? <Navigate to="/" replace /> : <SignUp />} />
            <Route path="/auth/otp" element={<OtpVerification />} />
            <Route path="/auth/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />
            <Route path="/auth/verify-email" element={<EmailVerification />} />

            <Route element={<AppLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/search" element={<Search />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/deals" element={<Deals />} />
              <Route path="/shop/:id" element={<ShopDetail />} />
              <Route path="/shop/:shopId/product/:productId" element={<ProductDetail />} />
              <Route path="/recommendations" element={<Recommendations />} />
              <Route path="/help" element={<HelpSupport />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/about" element={<About />} />

              <Route path="/cart" element={<RequireAuth><Cart /></RequireAuth>} />
              <Route
                path="/checkout"
                element={
                  <RequireAuth>
                    <RoleGuard permission={PERMISSIONS.PLACE_ORDER}>
                      <Checkout />
                    </RoleGuard>
                  </RequireAuth>
                }
              />
              <Route path="/orders" element={<RequireAuth><Orders /></RequireAuth>} />
              <Route path="/order/:id" element={<RequireAuth><OrderDetail /></RequireAuth>} />
              <Route path="/order/:id/confirmed" element={<RequireAuth><OrderConfirmation /></RequireAuth>} />
              <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
              <Route path="/wallet" element={<RequireAuth><CustomerWallet /></RequireAuth>} />
              <Route path="/favourites" element={<RequireAuth><Favourites /></RequireAuth>} />
              <Route path="/payments" element={<RequireAuth><PaymentMethods /></RequireAuth>} />
              <Route path="/addresses" element={<RequireAuth><Addresses /></RequireAuth>} />
              <Route path="/scheduled" element={<RequireAuth><ScheduledOrders /></RequireAuth>} />
              <Route path="/loyalty" element={<RequireAuth><Loyalty /></RequireAuth>} />
              <Route path="/gift-cards" element={<RequireAuth><GiftCards /></RequireAuth>} />
              <Route path="/group-orders" element={<RequireAuth><GroupOrders /></RequireAuth>} />
              <Route path="/corporate" element={<RequireAuth><CorporateAccounts /></RequireAuth>} />
              <Route path="/notifications" element={<RequireAuth><NotificationCentre /></RequireAuth>} />
              <Route path="/settings/notifications" element={<RequireAuth><NotificationsSettings /></RequireAuth>} />
              <Route path="/settings/security" element={<RequireAuth><Security /></RequireAuth>} />
              <Route path="/settings/language" element={<RequireAuth><Language /></RequireAuth>} />
              <Route path="/settings/delete-account" element={<RequireAuth><DeleteAccount /></RequireAuth>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </CartProvider>
    </CustomerAppGuard>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <QueryClientProvider client={queryClientInstance}>
            <Router>
              <AppRoutes />
            </Router>
            <Toaster />
            <Sonner richColors position="top-center" />
          </QueryClientProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
