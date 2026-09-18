// TENANT FORGOT PASSWORD PAGE //

import { AuthPageShell } from '@/components/organisms/login/AuthPageShell';
import { ForgotPassword } from '@/components/organisms/login/ForgotPassword';

export default async function TenantForgotPasswordPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return (
    <AuthPageShell>
      <ForgotPassword tenantSlug={tenantSlug} />
    </AuthPageShell>
  );
}
