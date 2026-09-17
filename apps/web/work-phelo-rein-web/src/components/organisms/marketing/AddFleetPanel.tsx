'use client';

import { useForm, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { CurrencyInput } from '@/components/atoms/CurrencyInput';
import { useTenantConfig } from '@/hooks/useTenantConfig';
import { useBranchOptions } from '@/hooks';
import { VEHICLE_TYPE_OPTIONS, ASSET_CONDITION_OPTIONS } from '@/lib/assetOptions';

interface FleetForm {
  name: string;
  serialNumber?: string;
  vehicleType?: string;
  purchaseDate?: string;
  purchaseCost?: string;
  currency: string;
  condition?: string;
  notes?: string;
  branchId?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: FleetForm & { type: 'VEHICLE' }) => void;
}

export function AddFleetPanel({ isOpen, onClose, onSubmit }: Props) {
  const { currency: tenantCurrency } = useTenantConfig();
  const { data: branchOptions = [] } = useBranchOptions();

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<FleetForm>({ defaultValues: { currency: tenantCurrency } });

  const vehicleTypeValue = useWatch({ control, name: 'vehicleType' });
  const conditionValue = useWatch({ control, name: 'condition' });
  const purchaseDateValue = useWatch({ control, name: 'purchaseDate' });
  const purchaseCostValue = useWatch({ control, name: 'purchaseCost' });
  const currencyValue = useWatch({ control, name: 'currency' });
  const branchIdValue = useWatch({ control, name: 'branchId' });

  const handleClose = () => {
    reset({ currency: tenantCurrency });
    onClose();
  };

  const handleFormSubmit = (data: FleetForm) => {
    onSubmit({ ...data, type: 'VEHICLE' });
    reset({ currency: tenantCurrency });
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Vehicle"
      description="Register a new vehicle in the fleet."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(handleFormSubmit)}>Add Vehicle</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Vehicle Details
        </p>

        <FormField
          label="Vehicle Name"
          registration={register('name', { required: 'Required' })}
          error={errors.name}
          placeholder="eg; Toyota Land Cruiser"
        />

        {/* Asset type — fixed to Vehicle, not editable */}
        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">Asset Type</label>
          <div className="flex items-center px-4 py-3 border border-gray-200 rounded-input bg-gray-50 text-sm text-gray-500 cursor-not-allowed select-none">
            Vehicle
          </div>
        </div>

        <FormField
          label="Registration Number"
          registration={register('serialNumber')}
          placeholder="eg; GR-1234-24"
        />

        <SearchSelect
          label="Vehicle Type"
          placeholder="Select vehicle type"
          value={vehicleTypeValue}
          onChange={(v) => setValue('vehicleType', v)}
          options={VEHICLE_TYPE_OPTIONS}
        />

        <DatePicker
          label="Purchase Date"
          value={purchaseDateValue}
          onChange={(v) => setValue('purchaseDate', v)}
          disableFuture
        />

        <CurrencyInput
          label="Purchase Cost"
          value={purchaseCostValue}
          currency={currencyValue}
          onValueChange={(v) => setValue('purchaseCost', v)}
          onCurrencyChange={(v) => setValue('currency', v)}
          placeholder="0.00"
        />

        <SearchSelect
          label="Condition"
          placeholder="Select condition"
          value={conditionValue}
          onChange={(v) => setValue('condition', v)}
          options={ASSET_CONDITION_OPTIONS}
        />

        <SearchSelect
          label="Branch"
          placeholder="Select branch"
          value={branchIdValue}
          onChange={(v) => setValue('branchId', v)}
          options={branchOptions.map((b) => ({ value: b.id, label: b.name }))}
        />

        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">Notes</label>
          <textarea
            {...register('notes')}
            rows={3}
            placeholder="Any additional notes about this vehicle…"
            className="w-full border border-gray-300 rounded-input px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-1 focus:ring-brand/20 focus:border-brand resize-none"
          />
        </div>
      </div>
    </SidePanel>
  );
}
