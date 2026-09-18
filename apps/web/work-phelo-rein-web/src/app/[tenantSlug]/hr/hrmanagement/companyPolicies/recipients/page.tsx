'use client';

import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { FormSection } from '@/components/atoms/FormSection';
import { cn } from '@/lib/utils';
import { useCompanyPoliciesSettings, useUpdateCompanyPoliciesSettings } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import type { CompanyPolicyCycleRecipient } from '@/types/hr';

const CYCLE_RECIPIENTS_OPTIONS: { value: CompanyPolicyCycleRecipient; label: string }[] = [
  { value: 'all', label: 'All Employees' },
  { value: 'permanent', label: 'Permanent Employees' },
  { value: 'contractual', label: 'Contractual Employees' },
  { value: 'probation', label: 'Probationary Employees' },
  { value: 'interns', label: 'Interns' },
];

interface RecipientsForm {
  cycleRecipients: CompanyPolicyCycleRecipient[];
}

export default function CycleRecipientsPage() {
  const toast = useToast();
  const canManage = usePermission(Permission.MANAGE_HR_SETTINGS);
  const { data: settings, isLoading } = useCompanyPoliciesSettings();
  const { mutate: updateSettings, isPending } = useUpdateCompanyPoliciesSettings();

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<RecipientsForm>({
    defaultValues: {
      cycleRecipients: [],
    },
  });

  useEffect(() => {
    if (settings) {
      reset({ cycleRecipients: settings.cycleRecipients });
    }
  }, [settings, reset]);

  const onSubmit = (data: RecipientsForm) => {
    updateSettings(data, {
      onSuccess: () => toast.success('Appraisal Cycle recipients saved'),
      onError: (err) => toast.error(extractError(err, 'Failed to save recipients')),
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
      <FormSection title="Default Appraisal Cycle Recipients">
        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">
            Default Appraisal Cycle Recipients
          </label>
          <p className="text-xs text-gray-500">
            Select which employee groups are included in appraisal cycles by default
          </p>
          <Controller
            name="cycleRecipients"
            control={control}
            render={({ field }) => (
              <div className="flex flex-col gap-0 border border-gray-200 rounded-lg overflow-hidden mt-1">
                {CYCLE_RECIPIENTS_OPTIONS.map((opt, i) => {
                  const checked = field.value.includes(opt.value);
                  const toggle = () => {
                    const next = checked
                      ? field.value.filter((v) => v !== opt.value)
                      : [...field.value, opt.value];
                    field.onChange(next);
                  };
                  return (
                    <label
                      key={opt.value}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 transition-colors',
                        canManage ? 'cursor-pointer' : 'cursor-default',
                        i > 0 && 'border-t border-gray-100',
                        checked
                          ? 'bg-blue-50'
                          : canManage
                            ? 'bg-white hover:bg-gray-50'
                            : 'bg-white',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={toggle}
                        disabled={!canManage}
                        className="w-4 h-4 rounded accent-blue-500 cursor-pointer disabled:cursor-default"
                      />
                      <span className="text-sm text-gray-900">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            )}
          />
        </div>
      </FormSection>

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
