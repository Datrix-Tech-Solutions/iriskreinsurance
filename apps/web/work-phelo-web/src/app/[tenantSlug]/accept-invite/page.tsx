import { AuthPageShell } from '@/components/organisms/login/AuthPageShell';
import SetPassword from '@/components/organisms/login/SetPassword';

export default async function TenantResetPasswordPage({}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  return (
    <AuthPageShell>
      <SetPassword />
    </AuthPageShell>
  );
}
