'use client';

import { useRef, useState, ClipboardEvent, KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AppLogo } from '@/components/atoms/AppLogo';
import { useVerifyOtp, useResendOtp, useForgotPassword } from '@/hooks';
import { Button } from '@/components/atoms/Button';
import { cardClass, cn } from '@/lib/utils';
import { extractError } from '@/lib/extractError';
import { useToast } from '@/hooks/useToast';

const OTP_LENGTH = 6;

interface OtpVerificationProps {
  tenantSlug?: string;
  /** When 'password-reset', skip the verify-otp API call and go straight to reset page */
  mode?: 'email-verification' | 'password-reset';
}

export function OtpVerification({ tenantSlug, mode = 'email-verification' }: OtpVerificationProps) {
  const router = useRouter();
  const toast = useToast();
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const { mutate, isPending } = useVerifyOtp();

  const handleVerify = () => {
    const otp = digits.join('');
    if (otp.length < OTP_LENGTH) return;

    if (mode === 'password-reset') {
      sessionStorage.setItem('fpOtp', otp);
      const base = tenantSlug ? `/${tenantSlug}` : '';
      router.push(`${base}/forgot-password/reset`);
      return;
    }

    setVerifyError(null);
    mutate(
      { otp, tenantSlug },
      {
        onSuccess: () => {
          const base = tenantSlug ? `/${tenantSlug}` : '';
          router.push(`${base}/forgot-password/reset`);
        },
        onError: (err) => {
          setVerifyError(extractError(err, 'Invalid code. Please try again.'));
        },
      },
    );
  };

  const handleChange = (index: number, value: string) => {
    const char = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    setVerifyError(null);
    if (char && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    const next = [...digits];
    pasted.split('').forEach((char, i) => {
      next[i] = char;
    });
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  const { mutate: resend, isPending: isResending } = useResendOtp();
  const { mutate: resendForgot, isPending: isResendingForgot } = useForgotPassword();

  const handleResend = () => {
    if (mode === 'password-reset') {
      const email = sessionStorage.getItem('fpEmail') ?? '';
      resendForgot(
        { email, tenantSlug: tenantSlug ?? '' },
        { onError: (err) => toast.error(extractError(err, 'Failed to resend code')) },
      );
    } else {
      resend(
        { tenantSlug },
        { onError: (err) => toast.error(extractError(err, 'Failed to resend code')) },
      );
    }
  };

  return (
    <div className={cardClass('w-full max-w-sm px-8 py-10')}>
      <div className="flex justify-center mb-6">
        <AppLogo />
      </div>

      <h1 className="text-2xl font-semibold text-gray-900 text-center mb-2">Verify Your Email</h1>
      <p className="text-sm text-gray-500 text-center mb-8">
        Enter the 6-digit code we sent to your email address.
      </p>

      {/* OTP boxes */}
      <div className="flex justify-center gap-3 mb-6">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            className={cn(
              'w-11 h-13 text-center text-lg font-semibold border rounded-input',
              'focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand',
              'transition-colors text-gray-900',
              verifyError ? 'border-red-500' : digit ? 'border-brand' : 'border-gray-300',
            )}
          />
        ))}
      </div>

      {verifyError && <p className="text-xs text-red-500 text-center mb-4">{verifyError}</p>}

      <Button
        onClick={handleVerify}
        isLoading={isPending}
        loadingText="Verifying..."
        disabled={digits.join('').length < OTP_LENGTH}
        className="w-full"
      >
        Verify Code
      </Button>

      <p className="text-center text-xs text-gray-400 mt-6">
        Didn&apos;t receive a code?{' '}
        <button
          onClick={handleResend}
          disabled={isResending || isResendingForgot}
          className="text-brand font-medium hover:underline disabled:opacity-50"
        >
          {isResending || isResendingForgot ? 'Resending...' : 'Resend'}
        </button>
      </p>
    </div>
  );
}
