import LoginPage from '@/components/auth/LoginPage';
import { Bike } from 'lucide-react';

export default function Login() {
  return (
    <LoginPage
      role="driver"
      portalTitle="DashZW Driver"
      portalSubtitle="Accept deliveries and earn"
      icon={Bike}
      signUpPath="/signup"
    />
  );
}
