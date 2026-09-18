// RESET PASSWORD PAGE //

import { Suspense } from 'react';
import { AuthPageShell } from '@/components/organisms/login/AuthPageShell';
import { ResetPassword } from '@/components/organisms/login/ResetPassword';

export default async function TenantResetPasswordPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return (
    <AuthPageShell>
      <Suspense>
        <ResetPassword tenantSlug={tenantSlug} />
      </Suspense>
    </AuthPageShell>
  );
}
