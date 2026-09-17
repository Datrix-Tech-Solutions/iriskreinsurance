'use client';

import { useEffect } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/atoms/Button';
import { FormSection } from '@/components/atoms/FormSection';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { usePayrollSettings, useUpdatePayrollSettings } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { inputClass } from '@/lib/utils';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import {
  PAYROLL_COUNTRY_OPTIONS,
  PayrollCountry,
  resolvePayrollCurrency,
} from '@/lib/payrollDisplay';

interface FinancesForm {
  payrollCountry: PayrollCountry;
  payrollCurrency: string;
  payrollTier2FundName: string;
  payrollTier3Enabled: boolean;
  payrollTier3Rate: string;
  payrollTier3SchemeName: string;
}

export default function FinancesPage() {
  const toast = useToast();
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const canReadPayrollSettings = usePermission(Permission.READ_PAYROLL);
  const canEditPayrollSettings = usePermission(Permission.MANAGE_PAYROLL_SETTINGS);

  useEffect(() => {
    if (!canReadPayrollSettings) {
      router.replace(`/${params.tenantSlug}/hr`);
    }
  }, [canReadPayrollSettings, router, params.tenantSlug]);

  const { data: settings, isLoading } = usePayrollSettings();
  const { mutate: updateSettings, isPending } = useUpdatePayrollSettings();

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { isDirty, errors },
  } = useForm<FinancesForm>({
    defaultValues: {
      payrollCountry: 'GH',
      payrollCurrency: 'GHS',
      payrollTier2FundName: '',
      payrollTier3Enabled: false,
      payrollTier3Rate: '',
      payrollTier3SchemeName: '',
    },
  });

  useEffect(() => {
    if (settings) {
      reset({
        payrollCountry: settings.payrollCountry,
        payrollCurrency: settings.payrollCurrency,
        payrollTier2FundName: settings.payrollTier2FundName ?? '',
        payrollTier3Enabled: settings.payrollTier3Enabled,
        payrollTier3Rate:
          settings.payrollTier3Rate != null ? String(settings.payrollTier3Rate) : '',
        payrollTier3SchemeName: settings.payrollTier3SchemeName ?? '',
      });
    }
  }, [settings, reset]);

  const payrollCountry = useWatch({ control, name: 'payrollCountry' });
  const tier3Enabled = useWatch({ control, name: 'payrollTier3Enabled' });
  const isGhanaPayroll = payrollCountry === 'GH';

  const onSubmit = (data: FinancesForm) => {
    const rate =
      data.payrollTier3Enabled && data.payrollTier3Rate
        ? parseFloat(data.payrollTier3Rate)
        : undefined;

    updateSettings(
      {
        payrollCountry: data.payrollCountry,
        payrollCurrency: resolvePayrollCurrency(null, data.payrollCountry),
        payrollTier2FundName: data.payrollTier2FundName.trim() || undefined,
        payrollTier3Enabled: data.payrollTier3Enabled,
        payrollTier3Rate: rate,
        payrollTier3SchemeName: data.payrollTier3Enabled
          ? data.payrollTier3SchemeName.trim() || undefined
          : undefined,
      },
      {
        onSuccess: () => toast.success('Finance settings saved'),
        onError: (err) => toast.error(extractError(err, 'Failed to save settings')),
      },
    );
  };

  if (isLoading)
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-8 h-8">
          <div className="absolute inset-0 rounded-full border-3 border-transparent border-t-brand animate-spin" />
          <div className="absolute inset-1.5 rounded-full border-3 border-transparent border-b-brand-accent animate-[spin_.6s_linear_infinite_reverse]" />
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-10">
      {/* Statutory Contributions */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-8 max-w-xl">
        <FormSection title="Payroll Country & Currency">
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              name="payrollCountry"
              control={control}
              render={({ field }) => (
                <SearchSelect
                  label="Payroll Country"
                  options={PAYROLL_COUNTRY_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                    sublabel: `${o.dialCode}, ${o.currency}`,
                  }))}
                  value={field.value}
                  onChange={(val) => {
                    field.onChange(val as PayrollCountry);
                    setValue('payrollCurrency', resolvePayrollCurrency(null, val), {
                      shouldDirty: true,
                    });
                  }}
                />
              )}
            />

            <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
              <label className="text-sm font-bold text-gray-900">Payroll Currency</label>
              <div className="px-4 py-3 border border-gray-200 rounded-input text-sm text-gray-500 bg-gray-50 select-none">
                {(() => {
                  const opt = PAYROLL_COUNTRY_OPTIONS.find((o) => o.value === payrollCountry);
                  return opt
                    ? `${opt.dialCode}, ${opt.currency}`
                    : resolvePayrollCurrency(null, payrollCountry);
                })()}
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400 -mt-2">
            Payroll calculations use this country for statutory deductions and PAYE. Currency is
            used for payroll displays, payslips, and exports.
          </p>
        </FormSection>

        <FormSection title={isGhanaPayroll ? 'Tier 2 — Provident Fund' : 'Statutory Pension'}>
          <FormField
            label="Fund Name"
            registration={register('payrollTier2FundName')}
            placeholder={isGhanaPayroll ? 'e.g. SSNIT Provident Fund' : 'e.g. Pension provider'}
          />
          <p className="text-xs text-gray-400 -mt-2">
            {isGhanaPayroll
              ? 'The name of your Tier 2 pension fund manager. Shown on payslips and statutory reports.'
              : 'Country-specific employee and employer statutory pension amounts are calculated automatically.'}
          </p>
        </FormSection>

        <FormSection title="Tier 3 — Voluntary Contribution">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="tier3-enabled"
              {...register('payrollTier3Enabled')}
              className="w-4 h-4 rounded accent-brand cursor-pointer"
            />
            <label
              htmlFor="tier3-enabled"
              className="text-sm font-medium text-gray-700 cursor-pointer"
            >
              Enable Tier 3 contributions
            </label>
          </div>

          {tier3Enabled && (
            <div className="flex flex-col gap-4 mt-1">
              <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
                <label className="text-sm font-bold text-gray-900">Contribution Rate (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    placeholder="e.g. 5"
                    {...register('payrollTier3Rate', {
                      required: tier3Enabled ? 'Rate is required when Tier 3 is enabled' : false,
                      min: { value: 0.1, message: 'Rate must be greater than 0' },
                      max: { value: 16, message: 'Rate cannot exceed 16%' },
                    })}
                    className={inputClass(errors.payrollTier3Rate?.message, 'pr-8')}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    %
                  </span>
                </div>
                {errors.payrollTier3Rate && (
                  <p className="text-xs text-red-500">{errors.payrollTier3Rate.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
                <label className="text-sm font-bold text-gray-900">Scheme Name</label>
                <input
                  type="text"
                  placeholder="e.g. Company Pension Scheme"
                  {...register('payrollTier3SchemeName', {
                    required: tier3Enabled
                      ? 'Scheme name is required when Tier 3 is enabled'
                      : false,
                  })}
                  className={inputClass(errors.payrollTier3SchemeName?.message)}
                />
                {errors.payrollTier3SchemeName && (
                  <p className="text-xs text-red-500">{errors.payrollTier3SchemeName.message}</p>
                )}
              </div>
            </div>
          )}
        </FormSection>

        <div>
          <Button
            type="submit"
            disabled={!isDirty || !canEditPayrollSettings}
            isLoading={isPending}
            loadingText="Saving…"
          >
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
