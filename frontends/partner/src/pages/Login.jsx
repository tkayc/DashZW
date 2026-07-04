import LoginPage from '@/components/auth/LoginPage';
import { Store } from 'lucide-react';

export default function Login() {
  return (
    <LoginPage
      role="partner"
      portalTitle="DashZW Partner"
      portalSubtitle="Manage your shop, menu & orders"
      icon={Store}
    />
  );
}
