'use client';

import { useEffect } from 'react';
import { Controller, UseFormReturn, useWatch } from 'react-hook-form';
import { cn, inputClass } from '@/lib/utils';
import { DatePicker } from '@/components/atoms/DatePicker';
import { Input } from '@/components/atoms/Input';
import { NumberField } from '@/components/atoms/NumberField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useCurrencyOptions, usePlacementEffectiveView, usePremiumPaymentContext } from '@/hooks';
import { ClaimState, Facultative } from '@/types/reinsurance';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

/** Lowercase form value for the claim-state selector. Maps to the backend
 *  `claimState` enum via {@link claimTagToState} / {@link claimStateToTag}. */
export type ClaimTag = 'pending' | 'finalized';

export const CLAIM_TAG_OPTIONS: { value: ClaimTag; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'finalized', label: 'Finalized' },
];

export const claimTagToState = (tag: ClaimTag): ClaimState =>
  tag === 'finalized' ? 'FINALIZED' : 'PENDING';

export const claimStateToTag = (state: ClaimState | null | undefined): ClaimTag =>
  state === 'FINALIZED' ? 'finalized' : 'pending';

export interface MakeClaimFormValues {
  claimNumber: string;
  claimTag: ClaimTag;
  estimatedLossAmount: string;
  finalLossAmount: string;
  occurrenceDate: string;
  reportedDate: string;
  claimCause: string;
  occurrenceDetails: string;
  currency: string;
  /** Conversion rate into the placement's currency — only used when `currency` differs
   * from the placement's own currency. */
  rate: string;
}

export const MAKE_CLAIM_DEFAULTS: MakeClaimFormValues = {
  claimNumber: '',
  claimTag: 'pending',
  estimatedLossAmount: '',
  finalLossAmount: '',
  occurrenceDate: '',
  reportedDate: '',
  claimCause: '',
  occurrenceDetails: '',
  currency: '',
  rate: '',
};

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
      <label className="text-sm font-bold text-gray-900">{label}</label>
      <div className="px-4 py-3 border border-gray-200 rounded-input bg-gray-50 text-sm text-gray-700">
        {value || '—'}
      </div>
    </div>
  );
}

interface MakeClaimFormFieldsProps {
  form: UseFormReturn<MakeClaimFormValues>;
  placement: Facultative;

  hidePlacementInfo?: boolean;
  isEditing?: boolean;

  mode?: 'notification' | 'actual';
}

export function MakeClaimFormFields({
  form,
  placement,
  hidePlacementInfo,
  isEditing,
  mode = 'notification',
}: MakeClaimFormFieldsProps) {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = form;

  const { data: currencyOptions = [] } = useCurrencyOptions();
  const occurrenceDate = useWatch({ control, name: 'occurrenceDate' });
  const claimCurrency = useWatch({ control, name: 'currency' });
  const rateValue = useWatch({ control, name: 'rate' });
  const showRate = !!claimCurrency && !!placement.currency && claimCurrency !== placement.currency;

  const conversionRate = showRate ? parseFloat(rateValue) || 1 : 1;

  useEffect(() => {
    if (!showRate) setValue('rate', '');
  }, [showRate, setValue]);

  const { statusText: premiumPaymentStatusText, latestPaymentDate } = usePremiumPaymentContext(
    placement.id,
  );
  const latestPaymentDateText = latestPaymentDate
    ? new Date(latestPaymentDate).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null;

  const effectiveAsOfDate = occurrenceDate ? new Date(occurrenceDate).toISOString() : undefined;
  const { data: effectiveView, isFetching: isLoadingEffectiveTerms } = usePlacementEffectiveView(
    placement.id,
    !!placement.id && !!effectiveAsOfDate,
    effectiveAsOfDate,
  );
  const effectiveTerms = effectiveView?.effectiveTerms;
  const effectiveSumInsured = effectiveTerms?.sumInsured ?? placement.sumInsured;
  const effectiveInceptionDate = effectiveTerms?.inceptionDate ?? placement.inceptionDate;
  const effectiveExpiryDate = effectiveTerms?.expiryDate ?? placement.expiryDate;
  const effectiveCurrency = effectiveTerms?.currency ?? placement.currency;

  return (
    <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
      {!hidePlacementInfo && (
        <>
          <ReadOnlyField
            label="Policy Number"
            value={displayPolicyNumber(placement.policyNumber)}
          />
          <ReadOnlyField label="Cedant" value={placement.cedant.name} />
          {placement.classOfBusiness && (
            <ReadOnlyField label="Class of Business" value={placement.classOfBusiness} />
          )}

          <hr className="border-gray-100" />
        </>
      )}
      <Input
        label="Claim Number"
        placeholder="Enter claim number…"
        {...register('claimNumber', { required: 'Claim number is required' })}
        error={errors.claimNumber?.message}
      />
      {/* Claim state (Pending / Finalized) — shown on the actual-claim form for both
          create and edit. Finalized generates reinsurer allocations server-side;
          returning an edited claim to Pending voids them. Never shown for Add
          Notification. The "Move to Open" modal has its own copy of this field. */}
      {mode === 'actual' && (
        <Controller
          name="claimTag"
          control={control}
          render={({ field }) => (
            <SearchSelect
              label="Claim state"
              placeholder="Select tag…"
              options={CLAIM_TAG_OPTIONS}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      )}
      <div className="flex flex-col gap-1 text-sm">
        <p className="text-gray-700">{premiumPaymentStatusText}</p>
        {latestPaymentDateText && (
          <div>
            <p className="text-gray-700">{latestPaymentDateText}</p>
            <p className="text-xs text-gray-400">Last Payment Date</p>
          </div>
        )}
      </div>
      <Controller
        name="occurrenceDate"
        control={control}
        rules={{
          required: 'Occurrence date is required',
          validate: (value) => {
            const date = new Date(value);
            if (effectiveInceptionDate && date < new Date(effectiveInceptionDate)) {
              return `Occurrence date cannot be before the effective inception date (${new Date(effectiveInceptionDate).toLocaleDateString()})`;
            }
            if (effectiveExpiryDate && date > new Date(effectiveExpiryDate)) {
              return `Occurrence date cannot be after the effective end date (${new Date(effectiveExpiryDate).toLocaleDateString()})`;
            }
            return true;
          },
        }}
        render={({ field }) => (
          <DatePicker
            label="Date of Loss"
            value={field.value}
            onChange={field.onChange}
            error={errors.occurrenceDate?.message}
          />
        )}
      />
      {occurrenceDate && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-900">
          <p className="font-semibold">Potential loss amount</p>
          <p className="mt-1">
            {isLoadingEffectiveTerms
              ? 'Loading potential loss for this date…'
              : [
                  effectiveCurrency ? `Currency ${effectiveCurrency}` : null,
                  effectiveSumInsured != null
                    ? `Sum insured ${effectiveSumInsured.toLocaleString()}`
                    : null,
                  effectiveInceptionDate
                    ? `From ${new Date(effectiveInceptionDate).toLocaleDateString()}`
                    : null,
                  effectiveExpiryDate
                    ? `to ${new Date(effectiveExpiryDate).toLocaleDateString()}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'No additional effective terms available.'}
          </p>
        </div>
      )}

      <div className={showRate ? 'grid grid-cols-2 gap-4' : ''}>
        <Controller
          name="currency"
          control={control}
          rules={{ required: 'Currency is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Currency"
              placeholder="Select currency…"
              options={currencyOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.currency?.message}
            />
          )}
        />
        {showRate && (
          <Controller
            name="rate"
            control={control}
            rules={{ min: { value: 0.000001, message: 'Rate is required' } }}
            render={({ field }) => (
              <NumberField
                label={`Rate to ${placement.currency}`}
                value={field.value ? Number(field.value) : 0}
                onChange={(n) => field.onChange(String(n))}
                error={errors.rate?.message}
                placeholder="0.00"
              />
            )}
          />
        )}
      </div>
      {(isEditing || mode === 'actual') && (
        <Controller
          name="finalLossAmount"
          control={control}
          rules={{
            ...(mode === 'actual' && {
              min: { value: 0.01, message: '100% Claim amount is required' },
            }),
            validate: (value) => {
              if (!value || Number(value) === 0) return true;
              const amount = parseFloat(value) * conversionRate;
              if (effectiveSumInsured != null && amount > effectiveSumInsured) {
                return `100%Claim amount cannot exceed the effective sum insured (${effectiveSumInsured.toLocaleString()})`;
              }
              return true;
            },
          }}
          render={({ field }) => (
            <NumberField
              label="100% Claim Amount"
              value={field.value ? Number(field.value) : 0}
              onChange={(n) => field.onChange(String(n))}
              error={errors.finalLossAmount?.message}
              placeholder="0.00"
            />
          )}
        />
      )}

      {mode !== 'actual' && (
        <Controller
          name="estimatedLossAmount"
          control={control}
          rules={{
            min: { value: 0.01, message: 'Claim amount is required' },
            validate: (value) => {
              const amount = parseFloat(value) * conversionRate;
              if (effectiveSumInsured != null && amount > effectiveSumInsured) {
                return `Claim amount cannot exceed the sum insured (${effectiveSumInsured.toLocaleString()})`;
              }
              return true;
            },
          }}
          render={({ field }) => (
            <NumberField
              label="100% Estimated Claim Amount"
              value={field.value ? Number(field.value) : 0}
              onChange={(n) => field.onChange(String(n))}
              error={errors.estimatedLossAmount?.message}
              placeholder="0.00"
            />
          )}
        />
      )}

      <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
        <label className="text-sm font-bold text-gray-900">Claim Details</label>
        <textarea
          {...register('claimCause', { required: 'Claim cause is required' })}
          placeholder="Describe the cause of the claim…"
          rows={3}
          className={cn(inputClass(), 'resize-none')}
        />
        {errors.claimCause && <p className="text-xs text-red-500">{errors.claimCause.message}</p>}
      </div>
    </div>
  );
}
