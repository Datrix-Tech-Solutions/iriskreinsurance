// RESET PASSWORD PAGE //

import { Suspense } from 'react';
import { AuthPageShell } from '@/components/organisms/login/AuthPageShell';
import { ResetPassword } from '@/components/organisms/login/ResetPassword';

export default function ResetPasswordPage() {
  return (
    <AuthPageShell>
      <Suspense>
        <ResetPassword />
      </Suspense>
    </AuthPageShell>
  );
}
