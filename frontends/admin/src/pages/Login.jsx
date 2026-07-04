import LoginPage from '@/components/auth/LoginPage';
import { Shield } from 'lucide-react';

export default function Login() {
  return (
    <LoginPage
      role="admin"
      portalTitle="DashZW Manager"
      portalSubtitle="Platform operations & settlements"
      icon={Shield}
    />
  );
}
