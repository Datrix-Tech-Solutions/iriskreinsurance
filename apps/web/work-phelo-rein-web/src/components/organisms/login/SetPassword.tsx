'use client';

import { useForm, useWatch } from 'react-hook-form';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useAcceptInvite } from '@/hooks';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { cn } from '@/lib/utils';
import { extractError } from '@/lib/errors';
import { AuthCard } from '@/components/organisms/login/AuthCard';

interface SetPasswordForm {
  password: string;
  confirmPassword: string;
}

const rules = [
  { label: '8+ characters', test: (v: string) => v.length >= 8 },
  { label: 'Uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'Number', test: (v: string) => /[0-9]/.test(v) },
  { label: 'Special character', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

export default function SetPassword() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const tenantSlug = params.tenantSlug as string;
  const token = searchParams.get('token') ?? '';

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<SetPasswordForm>();

  const password = useWatch({ control, name: 'password', defaultValue: '' });

  const { mutate, isPending } = useAcceptInvite();

  const handleSetPassword = (data: SetPasswordForm) => {
    mutate(
      { inviteToken: token, password: data.password },
      {
        onSuccess: () => {
          router.push(`/${tenantSlug}/hr`);
        },
        onError: (err) => {
          setError('root', { message: extractError(err) });
        },
      },
    );
  };

  if (!token) {
    return (
      <AuthCard title="Invalid Link" tenantSlug={tenantSlug}>
        <p className="text-white/70 text-center text-sm">
          This invitation link is invalid or has expired.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Set Your Password"
      tenantSlug={tenantSlug}
      subtitle="Create a password to access your WorkPhelo account."
    >
      <form
        onSubmit={handleSubmit(handleSetPassword)}
        className="flex flex-col gap-(--field-stack-gap,0.75rem) [&_input]:border-white/75! [&_input]:text-white/95! [&_input]:placeholder:text-white/75! [&_label]:text-white/75!"
      >
        <div>
          <FormField
            label="Password"
            registration={register('password', { required: 'Password is required' })}
            error={errors.password}
            type="password"
            placeholder="Create a password"
          />
          {/* Validation checklist */}
          <ul className="mt-2 flex flex-col gap-1">
            {rules.map(({ label, test }) => (
              <li
                key={label}
                className={cn(
                  'flex items-center gap-1.5 text-xs',
                  test(password) ? 'text-green-400' : 'text-white/55',
                )}
              >
                <span>{test(password) ? '✓' : '✗'}</span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <FormField
          label="Confirm Password"
          registration={register('confirmPassword', {
            required: 'Please confirm your password',
            validate: (v) => v === password || 'Passwords do not match',
          })}
          error={errors.confirmPassword}
          type="password"
          placeholder="Re-enter your password"
        />

        {errors.root && <p className="text-sm text-red-500">{errors.root.message}</p>}

        <Button
          type="submit"
          isLoading={isPending}
          loadingText="Setting password..."
          className="w-full mt-1"
        >
          Set Password
        </Button>
      </form>
    </AuthCard>
  );
}
