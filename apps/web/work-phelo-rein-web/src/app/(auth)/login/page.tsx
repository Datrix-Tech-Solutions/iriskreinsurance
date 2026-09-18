// SUPER ADMIN LOGIN PAGE //

import { AuthPageShell } from '@/components/organisms/login/AuthPageShell';
import { LoginForm } from '@/components/organisms/login/LoginForm';

export default function PlatformLoginPage() {
  return (
    <AuthPageShell>
      <LoginForm forgotPasswordHref="/forgot-password" />
    </AuthPageShell>
  );
}
