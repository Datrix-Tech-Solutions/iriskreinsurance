// LOGIN PAGE //

import { AuthPageShell } from '@/components/organisms/login/AuthPageShell';
import { LoginForm } from '@/components/organisms/login/LoginForm';

export default async function TenantLoginPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  return (
    <AuthPageShell>
      <LoginForm
        showSocialLogin
        tenantSlug={tenantSlug}
        forgotPasswordHref={`/${tenantSlug}/forgot-password`}
      />
    </AuthPageShell>
  );
}
