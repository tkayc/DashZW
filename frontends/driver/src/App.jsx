import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from 'sonner';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { useSystemNotifications } from '@/hooks/usePushNotifications';
import ErrorBoundary from '@/components/ErrorBoundary';
import Login from '@/pages/Login';
import DriverSignUp from '@/pages/DriverSignUp';
import DriverOnboarding from '@/pages/DriverOnboarding';
import RoadSafetyQuiz from '@/pages/RoadSafetyQuiz';
import DriverLayout from '@/pages/DriverLayout';
import DriverDashboard from '@/pages/DriverDashboard';
import DriverAvailableJobs from '@/pages/DriverAvailableJobs';
import DriverActiveDeliveries from '@/pages/DriverActiveDeliveries';
import DriverProfilePage from '@/pages/DriverProfilePage';
import DriverNavigation from '@/pages/DriverNavigation';
import DriverWallet from '@/pages/DriverWallet';
import SplashScreen from '@shared/components/SplashScreen';
import { useAppSplash } from '@shared/hooks/useAppSplash';
import { useEffect, useState } from 'react';
import { getDriverOnboardingStatus } from '@/api';

function OnboardingGate({ children }) {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.email) {
      setLoading(false);
      return;
    }
    getDriverOnboardingStatus()
      .then(setStatus)
      .catch(() => setStatus({ account_active: true })) // fail open for demo drivers if API hiccups
      .finally(() => setLoading(false));
  }, [user?.email]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // New accounts without a driver profile must finish registration.
  if (status?.needs_registration) {
    return <Navigate to="/onboarding" replace />;
  }

  // Demo / legacy drivers without document metadata are treated as active by the API.
  if (status && !status.account_active) {
    if (status.verification_status !== 'approved') {
      return <Navigate to="/onboarding" replace />;
    }
    if (!status.quiz_passed) {
      return <Navigate to="/quiz" replace />;
    }
  }

  return children;
}

function AppRoutes() {
  const { isLoadingAuth, isAuthenticated, user } = useAuth();
  const { showSplash, dismissSplash } = useAppSplash('driver', isAuthenticated);
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
        <Route path="/signup" element={<DriverSignUp />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (showSplash) {
    return (
      <SplashScreen
        onDone={dismissSplash}
        tagline="Driver hub"
        footer="On the road with DashZW"
      />
    );
  }

  return (
    <Routes>
      <Route path="/onboarding" element={<DriverOnboarding />} />
      <Route path="/quiz" element={<RoadSafetyQuiz />} />
      <Route
        element={
          <OnboardingGate>
            <DriverLayout />
          </OnboardingGate>
        }
      >
        <Route path="/" element={<DriverDashboard />} />
        <Route path="/jobs" element={<DriverAvailableJobs />} />
        <Route path="/active" element={<DriverActiveDeliveries />} />
        <Route path="/navigate/:orderId" element={<DriverNavigation />} />
        <Route path="/wallet" element={<DriverWallet />} />
        <Route path="/profile" element={<DriverProfilePage />} />
      </Route>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/signup" element={<Navigate to="/" replace />} />
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
