// TENANT OTP VERIFICATION PAGE //

import { AuthPageShell } from '@/components/organisms/login/AuthPageShell';
import { OtpVerification } from '@/components/organisms/login/OtpVerification';

export default async function TenantOtpVerificationPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return (
    <AuthPageShell>
      <OtpVerification tenantSlug={tenantSlug} mode="password-reset" />
    </AuthPageShell>
  );
}
