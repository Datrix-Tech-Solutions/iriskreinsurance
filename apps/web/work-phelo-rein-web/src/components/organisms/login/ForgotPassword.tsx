'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useForgotPassword } from '@/hooks';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { extractError } from '@/lib/extractError';
import { AuthCard } from '@/components/organisms/login/AuthCard';

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
      <AuthCard title="Check your email" tenantSlug={tenantSlug}>
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
            <svg
              className="w-7 h-7 text-white/80"
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

        <p className="text-sm text-white/70 text-center mb-2">
          We&apos;ve sent a password reset link to
        </p>
        <p className="text-sm font-medium text-white/85 text-center mb-6">{sentEmail}</p>
        <p className="text-xs text-white/55 text-center mb-6">
          Click the link in the email to reset your password. If you don&apos;t see it, check your
          spam folder.
        </p>

        <a href={backHref}>
          <Button variant="outline" className="w-full">
            Back to sign in
          </Button>
        </a>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgot Password"
      tenantSlug={tenantSlug}
      subtitle="Enter your email and we'll send you a link to reset your password."
    >
      <form
        onSubmit={handleSubmit(handleSubmit2)}
        className="flex flex-col gap-(--field-stack-gap,0.75rem) [&_input]:border-white/75! [&_input]:text-white/95! [&_input]:placeholder:text-white/75! [&_label]:text-white/75!"
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

      <p className="text-center text-xs text-white/55 mt-4">
        Remembered it?{' '}
        <a href={backHref} className="text-white/85 font-medium hover:underline">
          Sign in
        </a>
      </p>
    </AuthCard>
  );
}
