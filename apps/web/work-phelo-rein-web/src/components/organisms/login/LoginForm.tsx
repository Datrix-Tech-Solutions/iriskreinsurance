'use client';

import { useForm } from 'react-hook-form';
import { extractError } from '@/lib/extractError';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoginPayload } from '@/types/auth';
import { useLogin, useSuperAdminLogin } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { AuthCard } from '@/components/organisms/login/AuthCard';

interface LoginFormProps {
  showSocialLogin?: boolean;
  tenantSlug?: string;
  forgotPasswordHref?: string;
  redirectTo?: string;
}

export function LoginForm({
  tenantSlug,
  forgotPasswordHref = '/forgot-password',
  redirectTo = '/dashboard',
}: LoginFormProps) {
  const router = useRouter();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginPayload>();

  const isTenantLogin = !!tenantSlug;

  const { mutate: login, isPending: isTenantPending } = useLogin();
  const { mutate: adminLogin, isPending: isAdminPending } = useSuperAdminLogin();
  const isPending = isTenantPending || isAdminPending;

  const onSubmit = (data: LoginPayload) => {
    const onSuccess = () => {
      const destination = isTenantLogin ? `/${tenantSlug}/hr` : (redirectTo ?? '/dashboard');
      router.push(destination);
    };
    const onError = (err: unknown) => {
      toast.error(extractError(err, 'Invalid email or password'));
    };

    if (isTenantLogin) {
      login({ ...data, tenantSlug }, { onSuccess, onError });
    } else {
      adminLogin(data, { onSuccess, onError });
    }
  };

  return (
    <AuthCard title="Sign in" tenantSlug={tenantSlug}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-(--field-stack-gap,0.75rem) [&_input]:border-white/75! [&_input]:text-white/95! [&_input]:placeholder:text-white/75! [&_label]:text-white/75!"
      >
        <FormField
          label="Email"
          registration={register('email', { required: 'Email is required' })}
          error={errors.email}
          type="email"
          placeholder="Enter your organization assigned email"
        />

        <div className="flex flex-col gap-1">
          <FormField
            label="Password"
            registration={register('password', { required: 'Password is required' })}
            error={errors.password}
            type="password"
            placeholder="Enter your password"
          />
          <div className="flex justify-end">
            <Link
              href={forgotPasswordHref}
              className="text-xs text-white/75 hover:text-white transition-colors"
            >
              Forgot your Password?
            </Link>
          </div>
        </div>

        <Button
          type="submit"
          isLoading={isPending}
          loadingText="Signing in..."
          className="w-full mt-1"
        >
          Sign in
        </Button>
      </form>
    </AuthCard>
  );
}
