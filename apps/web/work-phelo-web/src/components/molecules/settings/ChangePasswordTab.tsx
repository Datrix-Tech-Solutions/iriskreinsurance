'use client';

import { useForm, useWatch } from 'react-hook-form';
import { FormField } from '@/components/molecules/shared/FormField';
import { Button } from '@/components/atoms/Button';
import { cn } from '@/lib/utils';
import { useChangePassword } from '@/hooks';
import { useToastStore } from '@/store/toast.store';
import { extractError } from '@/lib/extractError';

interface ChangePasswordForm {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const rules = [
  { label: '8+ characters', test: (v: string) => v.length >= 8 },
  { label: 'Uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'Number', test: (v: string) => /[0-9]/.test(v) },
  { label: 'Special character', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

export function ChangePasswordTab() {
  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors },
  } = useForm<ChangePasswordForm>();

  const newPassword = useWatch({ control, name: 'newPassword', defaultValue: '' });

  const { mutate, isPending } = useChangePassword();
  const addToast = useToastStore((s) => s.addToast);

  const handleChange = (data: ChangePasswordForm) => {
    mutate(
      { currentPassword: data.oldPassword, newPassword: data.newPassword },
      {
        onSuccess: () => {
          reset();
          addToast({ message: 'Password updated successfully', type: 'success' });
        },
        onError: (err) => {
          setError('root', { message: extractError(err) });
        },
      },
    );
  };

  return (
    <div className="py-6 flex flex-col gap-6 max-w-sm">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Change Password</h3>
        <p className="text-sm text-gray-400 mt-0.5">
          Update your account password. You&apos;ll need your current password to make changes.
        </p>
      </div>

      <div className="border-t border-gray-100" />

      <form
        onSubmit={handleSubmit(handleChange)}
        className="flex flex-col gap-(--field-stack-gap,0.75rem)"
      >
        <FormField
          label="Current Password"
          registration={register('oldPassword', { required: 'Current password is required' })}
          error={errors.oldPassword}
          type="password"
          placeholder="Enter current password"
        />

        <div>
          <FormField
            label="New Password"
            registration={register('newPassword', { required: 'New password is required' })}
            error={errors.newPassword}
            type="password"
            placeholder="Create new password"
          />
          <ul className="mt-2 flex flex-col gap-1">
            {rules.map(({ label, test }) => (
              <li
                key={label}
                className={cn(
                  'flex items-center gap-1.5 text-xs',
                  test(newPassword) ? 'text-green-600' : 'text-gray-400',
                )}
              >
                <span>{test(newPassword) ? '✓' : '✗'}</span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <FormField
          label="Confirm New Password"
          registration={register('confirmPassword', {
            required: 'Please confirm your new password',
            validate: (v) => v === newPassword || 'Passwords do not match',
          })}
          error={errors.confirmPassword}
          type="password"
          placeholder="Re-enter new password"
        />

        {errors.root && <p className="text-sm text-red-500">{errors.root.message}</p>}

        <div className="flex justify-end mt-1">
          <Button type="submit" isLoading={isPending} loadingText="Updating..." className="w-full">
            Update Password
          </Button>
        </div>
      </form>
    </div>
  );
}
