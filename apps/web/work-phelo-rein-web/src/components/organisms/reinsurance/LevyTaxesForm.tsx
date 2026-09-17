'use client';

import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { Icons } from '@/components/atoms/icons';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { TableButton } from '@/components/atoms/TableButton';
import { FormField } from '@/components/molecules/shared/FormField';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { cardClass } from '@/lib/utils';
import {
  useActivateReinsuranceCharge,
  useCreateReinsuranceCharge,
  useDeactivateReinsuranceCharge,
  useReinsuranceCharges,
  useUpdateReinsuranceCharge,
} from '@/hooks/reinsurance/useReinsuranceCharges';
import { useToast } from '@/hooks/useToast';
import { usePermissionRule } from '@/hooks/hr/usePermission';
import {
  LEVY_TAX_FORM_DEFAULTS,
  LevyTaxFormValues,
  ReinsuranceChargeCode,
  ReinsuranceChargeConfiguration,
  ReinsuranceChargePayload,
  ReinsuranceChargeType,
} from '@/types/reinsurance';

const codeLabels: Record<string, string> = {
  NIC_LEVY: 'NIC Levy',
  WITHHOLDING_TAX: 'Withholding Tax',
};

const chargeTypeByCode: Record<ReinsuranceChargeCode, ReinsuranceChargeType> = {
  NIC_LEVY: 'LEVY',
  WITHHOLDING_TAX: 'TAX',
};

const TYPE_OPTIONS: SearchSelectOption[] = [
  { value: 'NIC_LEVY', label: 'NIC Levy' },
  { value: 'WITHHOLDING_TAX', label: 'Withholding Tax' },
];

function errorMessage(error: unknown, fallback: string): string {
  const response = error as { response?: { data?: { message?: string } } };
  return response.response?.data?.message ?? fallback;
}

function toDateInput(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : '';
}

function toIsoDate(value: string): string {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

// code is deliberately excluded — it's create-only. The update DTO doesn't accept it,
// and the backend's whitelist validation rejects the whole request if it's present.
function toPayload(values: LevyTaxFormValues): Omit<ReinsuranceChargePayload, 'code'> {
  return {
    name: values.name,
    chargeType: values.chargeType,
    rateType: values.rateType,
    rate: Number(values.rate),
    calculationBasis: values.calculationBasis,
    direction: values.direction,
    currency: values.currency.trim() || null,
    effectiveFrom: toIsoDate(values.effectiveFrom),
    effectiveTo: values.effectiveTo ? toIsoDate(values.effectiveTo) : null,
    roundingMode: values.roundingMode,
    decimalPlaces: values.decimalPlaces,
    isEnabled: values.isEnabled,
    displayOrder: values.displayOrder,
  };
}

function fromConfiguration(config: ReinsuranceChargeConfiguration): LevyTaxFormValues {
  return {
    id: config.id,
    code: config.code,
    name: config.name,
    chargeType: config.chargeType,
    rateType: config.rateType,
    rate: Number(config.rate),
    calculationBasis: config.calculationBasis,
    direction: config.direction,
    currency: config.currency ?? '',
    effectiveFrom: toDateInput(config.effectiveFrom),
    effectiveTo: toDateInput(config.effectiveTo),
    roundingMode: config.roundingMode,
    decimalPlaces: config.decimalPlaces,
    isEnabled: config.isEnabled,
    displayOrder: config.displayOrder,
  };
}

export function LevyTaxesForm() {
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const canCreate = usePermissionRule('operations.reinsurance.taxes-levies:CREATE');
  const canEdit = usePermissionRule('operations.reinsurance.taxes-levies:EDIT');
  const canDelete = usePermissionRule('operations.reinsurance.taxes-levies:DELETE');

  const charges = useReinsuranceCharges();
  const createCharge = useCreateReinsuranceCharge();
  const updateCharge = useUpdateReinsuranceCharge();
  const activateCharge = useActivateReinsuranceCharge();
  const deactivateCharge = useDeactivateReinsuranceCharge();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isDirty },
  } = useForm<LevyTaxFormValues>({
    defaultValues: LEVY_TAX_FORM_DEFAULTS,
  });

  const selectedCharge = charges.data?.find((charge) => charge.id === selectedId);
  useEffect(() => {
    if (selectedCharge) reset(fromConfiguration(selectedCharge));
  }, [reset, selectedCharge]);

  const openCreate = () => {
    setSelectedId(null);
    reset(LEVY_TAX_FORM_DEFAULTS);
    setIsPanelOpen(true);
  };

  const openEdit = (charge: ReinsuranceChargeConfiguration) => {
    setSelectedId(charge.id);
    reset(fromConfiguration(charge));
    setIsPanelOpen(true);
  };

  const onSubmit = async (values: LevyTaxFormValues) => {
    try {
      const payload = toPayload(values);
      if (values.id) {
        await updateCharge.mutateAsync({ id: values.id, ...payload });
        toast.success('Tax and levy configuration updated');
      } else {
        const created = await createCharge.mutateAsync({ code: values.code, ...payload });
        setSelectedId(created.id);
        toast.success('Tax and levy configuration created');
      }
      setIsPanelOpen(false);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save tax and levy configuration'));
    }
  };

  const handleToggle = async (charge: ReinsuranceChargeConfiguration) => {
    try {
      if (charge.isEnabled) {
        await deactivateCharge.mutateAsync(charge.id);
        toast.success('Configuration deactivated');
      } else {
        await activateCharge.mutateAsync(charge.id);
        toast.success('Configuration activated');
      }
    } catch (error) {
      toast.error(errorMessage(error, 'Could not update configuration status'));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className={cardClass('overflow-hidden h-fit')}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-900">Configured Charges</h3>
          {canCreate && (
            <Button size="sm" icon={<Icons.Plus className="w-4 h-4" />} onClick={openCreate}>
              New Configuration
            </Button>
          )}
        </div>
        <div className="divide-y divide-gray-100">
          {charges.isLoading ? (
            <p className="p-6 text-sm text-gray-500">Loading configurations...</p>
          ) : charges.data?.length ? (
            charges.data.map((charge) => (
              <div
                key={charge.id}
                className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {codeLabels[charge.code] ?? charge.name}
                    <span className="ml-2 text-xs font-normal text-gray-500">{charge.name}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {charge.rateType === 'PERCENTAGE' ? `${charge.rate}%` : charge.rate}
                    {' · '}
                    {charge.direction.toLowerCase()}
                    {' · '}
                    {charge.currency ?? 'All currencies'}
                    {' · '}
                    from {toDateInput(charge.effectiveFrom)}
                    {charge.effectiveTo ? ` to ${toDateInput(charge.effectiveTo)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      charge.isEnabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {charge.isEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                  {canEdit && (
                    <TableButton variant="blue" onClick={() => openEdit(charge)}>
                      Edit
                    </TableButton>
                  )}
                  {canDelete && (
                    <TableButton
                      variant={charge.isEnabled ? 'red' : 'green'}
                      isLoading={activateCharge.isPending || deactivateCharge.isPending}
                      onClick={() => handleToggle(charge)}
                    >
                      {charge.isEnabled ? 'Deactivate' : 'Activate'}
                    </TableButton>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="p-6 text-sm text-gray-500">
              No charge configurations yet. Create one to get started.
            </p>
          )}
        </div>
      </div>

      <SidePanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        title={selectedId ? 'Edit Configuration' : 'New Configuration'}
        description="Configure the tenant-approved rate. No statutory rate is assumed by WorkPhelo."
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setIsPanelOpen(false)}
              disabled={createCharge.isPending || updateCharge.isPending}
            >
              Cancel
            </Button>
            <Button
              disabled={!isDirty}
              isLoading={createCharge.isPending || updateCharge.isPending}
              onClick={handleSubmit(onSubmit)}
            >
              {selectedId ? 'Update Configuration' : 'Create Configuration'}
            </Button>
          </div>
        }
      >
        <form
          className="flex flex-col gap-(--field-stack-gap,0.75rem)"
          onSubmit={handleSubmit(onSubmit)}
        >
          {selectedId ? (
            <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
              <label className="text-sm font-bold text-gray-900">Type</label>
              <div className="rounded-input border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-700">
                {selectedCharge
                  ? (codeLabels[selectedCharge.code] ?? selectedCharge.code)
                  : 'Locked'}
              </div>
              <p className="text-xs text-gray-500">
                Charge type is locked after creation. Create a new configuration for another type.
              </p>
            </div>
          ) : (
            <Controller
              name="code"
              control={control}
              rules={{ required: 'Type is required' }}
              render={({ field }) => (
                <SearchSelect
                  label="Type"
                  placeholder="Select type…"
                  options={TYPE_OPTIONS}
                  value={field.value}
                  onChange={(value) => {
                    const code = value as ReinsuranceChargeCode;
                    field.onChange(code);
                    setValue('chargeType', chargeTypeByCode[code], { shouldDirty: true });
                  }}
                  error={errors.code?.message}
                />
              )}
            />
          )}

          <FormField
            label="Name"
            registration={register('name', { required: 'Name is required' })}
            error={errors.name}
          />

          <FormField
            label="Rate (%)"
            type="number"
            step="0.000001"
            registration={register('rate', {
              required: 'Rate is required',
              valueAsNumber: true,
              min: { value: 0, message: 'Rate must be 0 or greater' },
            })}
            error={errors.rate}
            placeholder="Enter tenant-approved rate"
          />

          <Controller
            name="effectiveFrom"
            control={control}
            rules={{ required: 'Effective from date is required' }}
            render={({ field }) => (
              <DatePicker
                label="Effective From"
                value={field.value}
                onChange={field.onChange}
                error={errors.effectiveFrom?.message}
              />
            )}
          />
        </form>
      </SidePanel>
    </div>
  );
}
