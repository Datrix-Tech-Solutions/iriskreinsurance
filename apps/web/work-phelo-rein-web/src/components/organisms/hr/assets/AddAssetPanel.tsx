'use client';

import { useForm, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { Input } from '@/components/atoms/Input';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { CurrencyInput } from '@/components/atoms/CurrencyInput';
import { useTenantConfig } from '@/hooks/useTenantConfig';
import { useBranchOptions } from '@/hooks';
import {
  ASSET_TYPE_OPTIONS,
  VEHICLE_TYPE_OPTIONS,
  ASSET_CONDITION_OPTIONS,
} from '@/lib/assetOptions';

interface AssetForm {
  name: string;
  type: string;
  customType?: string;
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
  onSubmit: (data: AssetForm) => void;
}

export function AddAssetPanel({ isOpen, onClose, onSubmit }: Props) {
  const { currency: tenantCurrency } = useTenantConfig();
  const { data: branchOptions = [] } = useBranchOptions();

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<AssetForm>({ defaultValues: { currency: tenantCurrency } });

  const typeValue = useWatch({ control, name: 'type' });
  const conditionValue = useWatch({ control, name: 'condition' });
  const purchaseDateValue = useWatch({ control, name: 'purchaseDate' });
  const purchaseCostValue = useWatch({ control, name: 'purchaseCost' });
  const currencyValue = useWatch({ control, name: 'currency' });
  const branchIdValue = useWatch({ control, name: 'branchId' });
  const vehicleTypeValue = useWatch({ control, name: 'vehicleType' });

  const isVehicle = typeValue === 'VEHICLE';

  const handleClose = () => {
    reset({ currency: tenantCurrency });
    onClose();
  };

  const handleFormSubmit = (data: AssetForm) => {
    const payload = { ...data };
    if (payload.type !== 'OTHER') {
      delete payload.customType;
    }
    onSubmit(payload);
    reset({ currency: tenantCurrency });
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Asset"
      description="Register a new asset in the system."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(handleFormSubmit)}>Add Asset</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField
          label="Asset Name"
          registration={register('name', { required: 'Required' })}
          error={errors.name}
          placeholder="eg; MacBook Pro 14-inch"
        />

        <SearchSelect
          label="Asset Type"
          placeholder="Select type"
          value={typeValue}
          onChange={(v) => {
            setValue('type', v);
            if (v !== 'OTHER') setValue('customType', undefined);
          }}
          options={ASSET_TYPE_OPTIONS}
        />
        {typeValue === 'OTHER' && (
          <FormField
            label="Specify asset type"
            registration={register('customType', { required: 'Please specify the asset type' })}
            error={errors.customType}
            placeholder="eg; Projector"
          />
        )}

        <FormField
          label={isVehicle ? 'Registration Number' : 'Serial Number'}
          registration={register('serialNumber')}
          placeholder={isVehicle ? 'eg; GR-1234-24' : 'eg; C02XL0LFJGH5'}
        />

        {isVehicle && (
          <SearchSelect
            label="Vehicle Type"
            placeholder="Select vehicle type"
            value={vehicleTypeValue}
            onChange={(v) => setValue('vehicleType', v)}
            options={VEHICLE_TYPE_OPTIONS}
          />
        )}

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

        <Input
          label="Notes"
          type="textarea"
          rows={3}
          placeholder="Any additional notes about this asset…"
          {...register('notes')}
        />
      </div>
    </SidePanel>
  );
}
