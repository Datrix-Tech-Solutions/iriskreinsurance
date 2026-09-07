'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AppLogo } from '@/components/atoms/AppLogo';
import { useForgotPassword } from '@/hooks';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { extractError } from '@/lib/extractError';
import { cardClass } from '@/lib/utils';

interface ForgotPasswordForm {
  email: string;
}

interface ForgotPasswordProps {
  tenantSlug?: string;
}

export function ForgotPassword({ tenantSlug }: ForgotPasswordProps) {
  const [submitted, setSubmitted] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ForgotPasswordForm>();

  const { mutate, isPending } = useForgotPassword();
  const handleSubmit2 = (data: ForgotPasswordForm) => {
    mutate(
      { ...data, tenantSlug: tenantSlug ?? '' },
      {
        onSuccess: () => {
          setSentEmail(data.email);
          setSubmitted(true);
        },
        onError: (err) => {
          setError('root', { message: extractError(err, 'Failed to send reset link') });
        },
      },
    );
  };

  const backHref = tenantSlug ? `/${tenantSlug}/login` : '/login';

  if (submitted) {
    return (
      <div className={cardClass('w-full max-w-sm px-8 py-10')}>
        <div className="flex justify-center mb-6">
          <AppLogo />
        </div>

        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center">
            <svg
              className="w-7 h-7 text-orange-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-gray-900 text-center mb-2">Check your email</h1>
        <p className="text-sm text-gray-500 text-center mb-2">
          We&apos;ve sent a password reset link to
        </p>
        <p className="text-sm font-medium text-gray-800 text-center mb-6">{sentEmail}</p>
        <p className="text-xs text-gray-400 text-center mb-6">
          Click the link in the email to reset your password. If you don&apos;t see it, check your
          spam folder.
        </p>

        <a href={backHref}>
          <Button variant="outline" className="w-full">
            Back to sign in
          </Button>
        </a>
      </div>
    );
  }

  return (
    <div className={cardClass('w-full max-w-sm px-8 py-10')}>
      <div className="flex justify-center mb-6">
        <AppLogo />
      </div>

      <h1 className="text-2xl font-semibold text-gray-900 text-center mb-2">Forgot Password</h1>
      <p className="text-sm text-gray-500 text-center mb-6">
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>

      <form
        onSubmit={handleSubmit(handleSubmit2)}
        className="flex flex-col gap-(--field-stack-gap,0.75rem)"
      >
        <FormField
          label="Email"
          registration={register('email', { required: 'Email is required' })}
          error={errors.email}
          type="email"
          placeholder="Enter your organization assigned email"
        />

        {errors.root && <p className="text-sm text-red-500 text-center">{errors.root.message}</p>}

        <Button
          type="submit"
          isLoading={isPending}
          loadingText="Sending..."
          className="w-full mt-1"
        >
          Send Reset Link
        </Button>
      </form>

      <p className="text-center text-xs text-gray-400 mt-6">
        Remembered it?{' '}
        <a href={backHref} className="text-brand font-medium hover:underline">
          Sign in
        </a>
      </p>
    </div>
  );
}
