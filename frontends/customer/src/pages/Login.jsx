import LoginPage from '@/components/auth/LoginPage';

export default function Login() {
  return (
    <LoginPage
      role="customer"
      portalTitle="DashZW"
      portalSubtitle="Merchants delivered to your door"
      signUpPath="/signup"
    />
  );
}
