'use client';

import { useForm, useWatch } from 'react-hook-form';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { AppLogo } from '@/components/atoms/AppLogo';
import { useAcceptInvite } from '@/hooks';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { cardClass, cn } from '@/lib/utils';
import { extractError } from '@/lib/errors';

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
          router.push(`/${tenantSlug}/modules`);
        },
        onError: (err) => {
          setError('root', { message: extractError(err) });
        },
      },
    );
  };

  if (!token) {
    return (
      <div className={cardClass('w-full max-w-sm px-8 py-10 text-center')}>
        <div className="flex justify-center mb-6">
          <AppLogo />
        </div>
        <h1 className="text-xl font-semibold text-red-600">Invalid Link</h1>
        <p className="text-gray-500 mt-2 text-sm">
          This invitation link is invalid or has expired.
        </p>
      </div>
    );
  }

  return (
    <div className={cardClass('w-full max-w-sm px-8 py-10')}>
      <div className="flex justify-center mb-6">
        <AppLogo />
      </div>

      <h1 className="text-2xl font-semibold text-gray-900 text-center mb-2">Set Your Password</h1>
      <p className="text-sm text-gray-500 text-center mb-6">
        Create a password to access your WorkPhelo account.
      </p>

      <form
        onSubmit={handleSubmit(handleSetPassword)}
        className="flex flex-col gap-(--field-stack-gap,0.75rem)"
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
    </div>
  );
}
