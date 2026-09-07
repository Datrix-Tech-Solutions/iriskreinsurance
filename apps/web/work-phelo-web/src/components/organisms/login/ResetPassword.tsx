'use client';

import { useForm, useWatch } from 'react-hook-form';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppLogo } from '@/components/atoms/AppLogo';
import { useResetPassword } from '@/hooks';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { cardClass, cn } from '@/lib/utils';
import { extractError } from '@/lib/extractError';

interface ResetPasswordForm {
  password: string;
  confirmPassword: string;
}

interface ResetPasswordProps {
  tenantSlug?: string;
}

const rules = [
  { label: '8+ characters', test: (v: string) => v.length >= 8 },
  { label: 'Uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'Number', test: (v: string) => /[0-9]/.test(v) },
  { label: 'Special character', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

export function ResetPassword({ tenantSlug }: ResetPasswordProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<ResetPasswordForm>();

  const password = useWatch({ control, name: 'password', defaultValue: '' });

  const { mutate, isPending } = useResetPassword();

  const handleReset = (data: ResetPasswordForm) => {
    // Link flow: ?token=<code> is in the URL
    // OTP flow: code was stored in sessionStorage by the verify page
    const linkToken = searchParams.get('token') ?? undefined;
    const otpCode = linkToken ? undefined : (sessionStorage.getItem('fpOtp') ?? undefined);
    const email = linkToken ? undefined : (sessionStorage.getItem('fpEmail') ?? undefined);

    mutate(
      { token: linkToken, otpCode, newPassword: data.password, email, tenantSlug },
      {
        onSuccess: () => {
          sessionStorage.removeItem('fpOtp');
          sessionStorage.removeItem('fpEmail');
          const base = tenantSlug ? `/${tenantSlug}` : '';
          router.push(`${base}/login`);
        },
        onError: (err) => {
          setError('root', { message: extractError(err, 'Failed to reset password') });
        },
      },
    );
  };

  return (
    <div className={cardClass('w-full max-w-sm px-8 py-10')}>
      <div className="flex justify-center mb-6">
        <AppLogo />
      </div>

      <h1 className="text-2xl font-semibold text-gray-900 text-center mb-2">
        Set Your New Password
      </h1>
      <p className="text-sm text-gray-500 text-center mb-6">
        For security reasons, you must create a new password before accessing your workspace.
      </p>

      <form
        onSubmit={handleSubmit(handleReset)}
        className="flex flex-col gap-(--field-stack-gap,0.75rem)"
      >
        <div>
          <FormField
            label="Password"
            registration={register('password', { required: 'Password is required' })}
            error={errors.password}
            type="password"
            placeholder="Create new password"
          />
          {/* Validation checklist */}
          <ul className="mt-2 flex flex-col gap-1">
            {rules.map(({ label, test }) => (
              <li
                key={label}
                className={cn(
                  'flex items-center gap-1.5 text-xs',
                  test(password) ? 'text-green-600' : 'text-gray-400',
                )}
              >
                <span>{test(password) ? '✓' : '✗'}</span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <FormField
          label="Confirm New Password"
          registration={register('confirmPassword', {
            required: 'Please confirm your password',
            validate: (v) => v === password || 'Passwords do not match',
          })}
          error={errors.confirmPassword}
          type="password"
          placeholder="Re-enter new password"
        />

        {errors.root && <p className="text-sm text-red-500 text-center">{errors.root.message}</p>}

        <Button
          type="submit"
          isLoading={isPending}
          loadingText="Updating..."
          className="w-full mt-1"
        >
          Update Password
        </Button>
      </form>
    </div>
  );
}
