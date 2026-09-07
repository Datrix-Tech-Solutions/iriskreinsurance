'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { FormSection } from '@/components/atoms/FormSection';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { DataTable } from '@/components/organisms/shared/DataTable';
import type { Column } from '@/components/organisms/shared/DataTable';
import { Input } from '@/components/atoms/Input';
import { cn, inputClass } from '@/lib/utils';
import {
  useAppraisalSettings,
  useUpdateAppraisalSettings,
  useCompanyPoliciesSettings,
  useUpdateCompanyPoliciesSettings,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { useHrManagementAccess } from '@/hooks/hr/useHrManagementAccess';
import { useAuthStore } from '@/store/auth.store';
import { extractError } from '@/lib/extractError';
import { DEFAULT_PERFORMANCE_BANDS } from '@/types/hr';
import type { CompanyPolicyCycleRecipient } from '@/types/hr';

// ── Types ──────────────────────────────────────────────────────────────────

type ThresholdKey =
  | 'outstandingThreshold'
  | 'veryGoodThreshold'
  | 'goodThreshold'
  | 'satisfactoryThreshold';

interface BandConfig {
  key: ThresholdKey;
  label: string;
  backgroundColor: string;
  textColor: string;
  currentMin: number;
  derivedMax: number;
  minAllowed: number;
  maxAllowed: number;
}

interface BandTableRow {
  id: number;
  key: ThresholdKey | 'needsImprovement';
  label: string;
  backgroundColor: string;
  textColor: string;
  min: number;
  max: number;
  editable: boolean;
}

interface SettingsForm {
  outstandingThreshold: number;
  veryGoodThreshold: number;
  goodThreshold: number;
  satisfactoryThreshold: number;
  cycleRecipients: CompanyPolicyCycleRecipient[];
}

const CYCLE_RECIPIENTS_OPTIONS: { value: CompanyPolicyCycleRecipient; label: string }[] = [
  { value: 'all', label: 'All Employees' },
  { value: 'permanent', label: 'Permanent Employees' },
  { value: 'contractual', label: 'Contractual Employees' },
  { value: 'probation', label: 'Probationary Employees' },
  { value: 'interns', label: 'Interns' },
];

// ── Band Edit Panel ─────────────────────────────────────────────────────────

function BandEditPanel({
  band,
  onClose,
  onSave,
}: {
  band: BandConfig | null;
  onClose: () => void;
  onSave: (key: ThresholdKey, min: number) => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{ min: number }>({ defaultValues: { min: 0 } });

  useEffect(() => {
    if (band) reset({ min: band.currentMin });
  }, [band, reset]);

  const onSubmit = ({ min }: { min: number }) => {
    if (!band) return;
    onSave(band.key, Number(min));
    onClose();
  };

  return (
    <SidePanel
      isOpen={!!band}
      onClose={onClose}
      title={band?.label ?? ''}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)}>Save</Button>
        </div>
      }
    >
      {band && (
        <div className="flex gap-4">
          <Input
            label="Min"
            type="number"
            placeholder={String(band.currentMin)}
            error={errors.min?.message}
            {...register('min', {
              required: 'Required',
              valueAsNumber: true,
              min: {
                value: band.minAllowed,
                message: `Must be at least ${band.minAllowed}%`,
              },
              max: {
                value: band.maxAllowed,
                message: `Must be at most ${band.maxAllowed}%`,
              },
            })}
          />
          <div className="flex flex-col gap-(--field-label-gap,0.125rem) flex-1">
            <label className="text-sm font-bold text-gray-900">Max</label>
            <input
              type="number"
              value={band.derivedMax}
              readOnly
              onChange={() => {}}
              className={cn(inputClass(), 'bg-gray-50 cursor-default')}
            />
          </div>
        </div>
      )}
    </SidePanel>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function AppraisalSettingsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { canConfigureAppraisal } = useHrManagementAccess();
  const toast = useToast();

  const { data: appraisalSettings, isLoading: isLoadingAppraisal } = useAppraisalSettings();
  const { data: companySettings, isLoading: isLoadingCompany } = useCompanyPoliciesSettings();
  const { mutate: updateAppraisalSettings, isPending: isPendingAppraisal } =
    useUpdateAppraisalSettings();
  const { mutate: updateCompanySettings, isPending: isPendingCompany } =
    useUpdateCompanyPoliciesSettings();

  const [editingBand, setEditingBand] = useState<BandConfig | null>(null);

  const {
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { isDirty },
  } = useForm<SettingsForm>({
    defaultValues: {
      outstandingThreshold: 90,
      veryGoodThreshold: 80,
      goodThreshold: 70,
      satisfactoryThreshold: 60,
      cycleRecipients: [],
    },
  });

  useEffect(() => {
    if (user !== null && !canConfigureAppraisal) {
      router.replace(`/${tenantSlug}/hr`);
    }
  }, [canConfigureAppraisal, router, tenantSlug, user]);

  useEffect(() => {
    if (appraisalSettings && companySettings) {
      reset({
        outstandingThreshold: appraisalSettings.outstandingThreshold,
        veryGoodThreshold: appraisalSettings.veryGoodThreshold,
        goodThreshold: appraisalSettings.goodThreshold,
        satisfactoryThreshold: appraisalSettings.satisfactoryThreshold,
        cycleRecipients: companySettings.cycleRecipients,
      });
    }
  }, [appraisalSettings, companySettings, reset]);

  const [outstanding, veryGood, good, satisfactory] = useWatch({
    control,
    name: ['outstandingThreshold', 'veryGoodThreshold', 'goodThreshold', 'satisfactoryThreshold'],
  });

  // Derive the constraint config for each band from current live form values
  const getBandConfig = (key: ThresholdKey): BandConfig => {
    const base = {
      outstandingThreshold: {
        label: 'Outstanding',
        backgroundColor: DEFAULT_PERFORMANCE_BANDS[0].backgroundColor,
        textColor: DEFAULT_PERFORMANCE_BANDS[0].textColor,
        currentMin: Number(outstanding),
        derivedMax: 100,
        minAllowed: Number(veryGood) + 1,
        maxAllowed: 99,
      },
      veryGoodThreshold: {
        label: 'Very Good',
        backgroundColor: DEFAULT_PERFORMANCE_BANDS[1].backgroundColor,
        textColor: DEFAULT_PERFORMANCE_BANDS[1].textColor,
        currentMin: Number(veryGood),
        derivedMax: Number(outstanding),
        minAllowed: Number(good) + 1,
        maxAllowed: Number(outstanding) - 1,
      },
      goodThreshold: {
        label: 'Good',
        backgroundColor: DEFAULT_PERFORMANCE_BANDS[2].backgroundColor,
        textColor: DEFAULT_PERFORMANCE_BANDS[2].textColor,
        currentMin: Number(good),
        derivedMax: Number(veryGood),
        minAllowed: Number(satisfactory) + 1,
        maxAllowed: Number(veryGood) - 1,
      },
      satisfactoryThreshold: {
        label: 'Satisfactory',
        backgroundColor: DEFAULT_PERFORMANCE_BANDS[3].backgroundColor,
        textColor: DEFAULT_PERFORMANCE_BANDS[3].textColor,
        currentMin: Number(satisfactory),
        derivedMax: Number(good),
        minAllowed: 1,
        maxAllowed: Number(good) - 1,
      },
    };
    return { key, ...base[key] };
  };

  const bandRows: BandTableRow[] = [
    {
      id: 1,
      key: 'outstandingThreshold',
      label: 'Outstanding',
      backgroundColor: DEFAULT_PERFORMANCE_BANDS[0].backgroundColor,
      textColor: DEFAULT_PERFORMANCE_BANDS[0].textColor,
      min: Number(outstanding),
      max: 100,
      editable: true,
    },
    {
      id: 2,
      key: 'veryGoodThreshold',
      label: 'Very Good',
      backgroundColor: DEFAULT_PERFORMANCE_BANDS[1].backgroundColor,
      textColor: DEFAULT_PERFORMANCE_BANDS[1].textColor,
      min: Number(veryGood),
      max: Number(outstanding),
      editable: true,
    },
    {
      id: 3,
      key: 'goodThreshold',
      label: 'Good',
      backgroundColor: DEFAULT_PERFORMANCE_BANDS[2].backgroundColor,
      textColor: DEFAULT_PERFORMANCE_BANDS[2].textColor,
      min: Number(good),
      max: Number(veryGood),
      editable: true,
    },
    {
      id: 4,
      key: 'satisfactoryThreshold',
      label: 'Satisfactory',
      backgroundColor: DEFAULT_PERFORMANCE_BANDS[3].backgroundColor,
      textColor: DEFAULT_PERFORMANCE_BANDS[3].textColor,
      min: Number(satisfactory),
      max: Number(good),
      editable: true,
    },
    {
      id: 5,
      key: 'needsImprovement',
      label: 'Needs Improvement',
      backgroundColor: DEFAULT_PERFORMANCE_BANDS[4].backgroundColor,
      textColor: DEFAULT_PERFORMANCE_BANDS[4].textColor,
      min: 0,
      max: Number(satisfactory),
      editable: false,
    },
  ];

  const bandColumns: Column<BandTableRow>[] = [
    {
      key: 'band',
      label: 'Band',
      render: (row) => (
        <span
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
          style={{ backgroundColor: row.backgroundColor, color: row.textColor }}
        >
          {row.label}
        </span>
      ),
    },
    {
      key: 'threshold',
      label: 'Threshold',
      render: (row) => (
        <span className="text-sm text-gray-700">
          {row.min}% – {row.max}%
        </span>
      ),
    },
  ];

  const handleBandSave = (key: ThresholdKey, min: number) => {
    setValue(key, min, { shouldDirty: true });
  };

  const onSubmit = (data: SettingsForm) => {
    let completed = 0;
    const onBothDone = () => {
      completed += 1;
      if (completed === 2) toast.success('Appraisal settings saved');
    };

    updateAppraisalSettings(
      {
        outstandingThreshold: Number(data.outstandingThreshold),
        veryGoodThreshold: Number(data.veryGoodThreshold),
        goodThreshold: Number(data.goodThreshold),
        satisfactoryThreshold: Number(data.satisfactoryThreshold),
        // pass through existing value — not editable in this UI but required by the backend
        appraisalEligibleStatuses: appraisalSettings?.appraisalEligibleStatuses,
      },
      {
        onSuccess: onBothDone,
        onError: (err) => toast.error(extractError(err, 'Failed to save performance bands')),
      },
    );

    updateCompanySettings(
      { cycleRecipients: data.cycleRecipients },
      {
        onSuccess: onBothDone,
        onError: (err) => toast.error(extractError(err, 'Failed to save cycle recipients')),
      },
    );
  };

  if (user !== null && !canConfigureAppraisal) return null;

  if (isLoadingAppraisal || isLoadingCompany)
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-8 h-8">
          <div className="absolute inset-0 rounded-full border-3 border-transparent border-t-brand animate-spin" />
          <div className="absolute inset-1.5 rounded-full border-3 border-transparent border-b-brand-accent animate-[spin_.6s_linear_infinite_reverse]" />
        </div>
      </div>
    );

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-8">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Performance Bands */}
          <FormSection title="Performance Bands">
            <div>
              <p className="text-xs text-gray-500text-xs text-gray-500 mt-0.5">
                Score thresholds that determine each employee&apos;s final rating
              </p>
            </div>
            <DataTable
              columns={bandColumns}
              data={bandRows}
              currentPage={1}
              totalPages={1}
              onPageChange={() => {}}
              noInternalScroll
              rowActions={
                canConfigureAppraisal
                  ? (row) =>
                      row.editable
                        ? [
                            {
                              label: 'Edit',
                              onClick: () => setEditingBand(getBandConfig(row.key as ThresholdKey)),
                            },
                          ]
                        : []
                  : undefined
              }
            />
          </FormSection>

          {/* Cycle Recipients */}
          <FormSection title="Default Appraisal Cycle Recipients">
            <div className="flex flex-col gap-4">
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
                            canConfigureAppraisal ? 'cursor-pointer' : 'cursor-default',
                            i > 0 && 'border-t border-gray-100',
                            checked
                              ? 'bg-blue-50'
                              : canConfigureAppraisal
                                ? 'bg-white hover:bg-gray-50'
                                : 'bg-white',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={toggle}
                            disabled={!canConfigureAppraisal}
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
        </div>

        {canConfigureAppraisal && (
          <div>
            <Button
              type="submit"
              disabled={!isDirty}
              isLoading={isPendingAppraisal || isPendingCompany}
              loadingText="Saving..."
            >
              Save Changes
            </Button>
          </div>
        )}
      </form>

      <BandEditPanel
        band={editingBand}
        onClose={() => setEditingBand(null)}
        onSave={handleBandSave}
      />
    </>
  );
}
