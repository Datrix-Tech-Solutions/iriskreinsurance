// FORGOT PASSWORD PAGE //

import { AuthPageShell } from '@/components/organisms/login/AuthPageShell';
import { ForgotPassword } from '@/components/organisms/login/ForgotPassword';

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell>
      <ForgotPassword />
    </AuthPageShell>
  );
}
