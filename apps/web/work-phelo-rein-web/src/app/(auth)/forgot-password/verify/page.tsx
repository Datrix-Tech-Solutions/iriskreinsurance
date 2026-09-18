// OTP PAGE //

import { AuthPageShell } from '@/components/organisms/login/AuthPageShell';
import { OtpVerification } from '@/components/organisms/login/OtpVerification';

export default function OtpVerificationPage() {
  return (
    <AuthPageShell>
      <OtpVerification />
    </AuthPageShell>
  );
}
