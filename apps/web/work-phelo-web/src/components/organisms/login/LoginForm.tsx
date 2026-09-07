'use client';

import { useForm } from 'react-hook-form';
import { extractError } from '@/lib/extractError';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLogo } from '@/components/atoms/AppLogo';
import { WorkPheloWordmark } from '@/components/atoms/WorkPheloWordmark';
import { LoginPayload } from '@/types/auth';
import { useLogin, useSuperAdminLogin } from '@/hooks/useAuth';
import { usePublicTenantBranding } from '@/hooks/useTenants';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/atoms/Button';
// import { GoogleButton } from '@/components/atoms/GoogleButton';
// import { MicrosoftButton } from '@/components/atoms/MicrosoftButton';
import { FormField } from '@/components/molecules/shared/FormField';
import { cardClass } from '@/lib/utils';

interface LoginFormProps {
  showSocialLogin?: boolean;
  tenantSlug?: string;
  forgotPasswordHref?: string;
  redirectTo?: string;
}

export function LoginForm({
  // showSocialLogin = false,
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

  const { data: branding, isError: isBrandingError } = usePublicTenantBranding(tenantSlug);

  const { mutate: login, isPending: isTenantPending } = useLogin();
  const { mutate: adminLogin, isPending: isAdminPending } = useSuperAdminLogin();
  const isPending = isTenantPending || isAdminPending;

  const onSubmit = (data: LoginPayload) => {
    const onSuccess = () => {
      const destination = isTenantLogin ? `/${tenantSlug}/modules` : (redirectTo ?? '/dashboard');
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
    <div className={cardClass('w-full max-w-sm px-8 py-10')}>
      {isTenantLogin ? (
        <div className="text-center mb-3">
          <p className="text-sm text-gray-500">
            Welcome to <WorkPheloWordmark />
          </p>
          {branding?.tenantName && (
            <p className="text-2xl font-bold text-gray-900 mt-2">{branding.tenantName}</p>
          )}
          {isBrandingError && (
            <p className="text-sm text-red-500 mt-2">
              We couldn&apos;t find this organization. Please check the link and try again.
            </p>
          )}
        </div>
      ) : (
        <div className="flex justify-center mb-3">
          <AppLogo />
        </div>
      )}

      <h1 className="text-xl font-semibold text-gray-900 text-center mb-3">Sign in</h1>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-(--field-stack-gap,0.75rem)"
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
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
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

      {/* {showSocialLogin && (
        <>
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">Sign in with</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <div className="flex gap-3">
            <GoogleButton className="flex-1" />
            <MicrosoftButton className="flex-1" />
          </div>
        </>
      )} */}
    </div>
  );
}
