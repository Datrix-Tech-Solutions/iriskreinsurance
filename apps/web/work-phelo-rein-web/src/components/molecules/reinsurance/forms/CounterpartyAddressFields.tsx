'use client';

import { Controller, useWatch } from 'react-hook-form';
import type {
  Control,
  UseFormRegister,
  UseFormSetValue,
  FieldErrors,
  FieldValues,
  Path,
} from 'react-hook-form';
import { FormField } from '@/components/molecules/shared/FormField';
import { FormSection } from '@/components/atoms/FormSection';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { COUNTRY_OPTIONS, GHANA_REGIONS } from '@/lib/geo';

/**
 * Shared location section for Cedant / Reinsurer / Broker add panels.
 *
 * - Country: always visible (Ghana | Africa | Europe | Asia | Rest of the World)
 * - Region + Street Name + City: only shown when Ghana is selected
 */
interface CounterpartyAddressFieldsProps<T extends FieldValues> {
  control: Control<T>;
  register: UseFormRegister<T>;
  setValue: UseFormSetValue<T>;
  errors: FieldErrors<T>;
}

export function CounterpartyAddressFields<T extends FieldValues>({
  control,
  register,
  setValue,
  errors,
}: CounterpartyAddressFieldsProps<T>) {
  const country = useWatch({ control, name: 'address.country' as Path<T> });
  const isGhana = country === 'Ghana';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addrErrors = (errors as any)?.address ?? {};

  return (
    <FormSection title="Address Details">
      <div className="flex flex-col gap-4">
        {/* Country / Territory */}
        <Controller
          name={'address.country' as Path<T>}
          control={control}
          render={({ field }) => (
            <SearchSelect
              label="Country / Territory"
              placeholder="Select country…"
              options={COUNTRY_OPTIONS}
              value={field.value}
              onChange={(v) => {
                field.onChange(v);
                setValue('address.state' as Path<T>, '' as Parameters<typeof setValue>[1]);
                setValue('address.streetName' as Path<T>, '' as Parameters<typeof setValue>[1]);
                setValue('address.city' as Path<T>, '' as Parameters<typeof setValue>[1]);
              }}
              error={addrErrors.country?.message}
            />
          )}
        />

        {/* Region — Ghana only */}
        {isGhana && (
          <Controller
            name={'address.state' as Path<T>}
            control={control}
            render={({ field }) => (
              <SearchSelect
                label="Region"
                placeholder="Select region…"
                options={GHANA_REGIONS}
                value={field.value}
                onChange={field.onChange}
                error={addrErrors.state?.message}
              />
            )}
          />
        )}

        {/* Street Name — Ghana only */}
        {/* {isGhana && (
          <FormField
            label="Street Name"
            registration={register('address.streetName' as Path<T>)}
            error={addrErrors.streetName}
            placeholder="e.g. Independence Avenue"
          />
    )} */}

        {/* City — Ghana only */}
        <FormField
          label="Address"
          registration={register('address.city' as Path<T>)}
          error={addrErrors.city}
          placeholder="e.g. Accra Community 3 Ave"
        />
      </div>
    </FormSection>
  );
}
