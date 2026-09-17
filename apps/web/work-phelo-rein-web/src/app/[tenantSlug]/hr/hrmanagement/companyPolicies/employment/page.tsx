'use client';

import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { FormSection } from '@/components/atoms/FormSection';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useCompanyPoliciesSettings, useUpdateCompanyPoliciesSettings } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import type { CompanyPolicyProbationPeriod, CompanyPolicyResignationWindow } from '@/types/hr';

const PROBATION_OPTIONS = [
  { value: '3', label: '3 months' },
  { value: '4', label: '4 months' },
  { value: '5', label: '5 months' },
  { value: '6', label: '6 months' },
  { value: 'undefined', label: 'Undefined (7+ months)' },
];

const RESIGNATION_OPTIONS = [
  { value: '1w', label: '1 week' },
  { value: '2w', label: '2 weeks' },
  { value: '1m', label: '1 month' },
  { value: '2m', label: '2 months' },
  { value: '3m', label: '3 months' },
  { value: '6m', label: '6 months' },
  { value: '1y', label: '1 year' },
  { value: '2y', label: '2 years' },
];

interface EmploymentForm {
  probationPeriod: CompanyPolicyProbationPeriod;
  resignationWindow: CompanyPolicyResignationWindow;
}

export default function EmploymentPoliciesPage() {
  const toast = useToast();
  const canManage = usePermission(Permission.MANAGE_HR_SETTINGS);
  const { data: settings, isLoading } = useCompanyPoliciesSettings();
  const { mutate: updateSettings, isPending } = useUpdateCompanyPoliciesSettings();

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<EmploymentForm>({
    defaultValues: {
      probationPeriod: '3',
      resignationWindow: '1m',
    },
  });

  useEffect(() => {
    if (settings) {
      reset({
        probationPeriod: settings.probationPeriod,
        resignationWindow: settings.resignationWindow,
      });
    }
  }, [settings, reset]);

  const onSubmit = (data: EmploymentForm) => {
    updateSettings(data, {
      onSuccess: () => toast.success('Employment policies saved'),
      onError: (err) => toast.error(extractError(err, 'Failed to save policies')),
    });
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
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-8 max-w-xl">
      <fieldset disabled={!canManage} className="contents">
        <FormSection title="Employment">
          <Controller
            name="probationPeriod"
            control={control}
            render={({ field }) => (
              <SearchSelect
                label="Default Probation Period"
                placeholder="Select probation period"
                options={PROBATION_OPTIONS}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </FormSection>

        <FormSection title="Resignation">
          <Controller
            name="resignationWindow"
            control={control}
            render={({ field }) => (
              <SearchSelect
                label="Resignation Notice Period"
                placeholder="Select notice period"
                options={RESIGNATION_OPTIONS}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </FormSection>
      </fieldset>

      {canManage && (
        <div>
          <Button type="submit" disabled={!isDirty} isLoading={isPending} loadingText="Saving...">
            Save Changes
          </Button>
        </div>
      )}
    </form>
  );
}
