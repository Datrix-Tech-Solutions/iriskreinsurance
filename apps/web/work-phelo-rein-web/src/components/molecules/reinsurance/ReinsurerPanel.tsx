'use client';

import { Controller, useFieldArray } from 'react-hook-form';
import type { Control, UseFormRegister, FieldError, FieldValues } from 'react-hook-form';
import { FormField } from '@/components/molecules/shared/FormField';
import { Icons } from '@/components/atoms/icons';
import { cn } from '@/lib/utils';
import { ReinsurerPanelRow, DEFAULT_REINSURER_ROW } from '@/types/reinsurance';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';

export interface ReinsurerPanelErrors {
  reinsurerPanel?: Array<{ reinsurer?: FieldError; reinsurerShare?: FieldError } | undefined>;
}

interface ReinsurerPanelProps {
  control: Control<FieldValues>;
  register: UseFormRegister<FieldValues>;
  errors: ReinsurerPanelErrors;
  reinsurerPanelValues: ReinsurerPanelRow[];
  maxShare: number | null;
  reinsurerOptions?: SearchSelectOption[];
}

export function ReinsurerPanel({
  control,
  register,
  errors,
  reinsurerPanelValues,
  maxShare,
  reinsurerOptions = [],
}: ReinsurerPanelProps) {
  const { fields, append, remove } = useFieldArray({ control, name: 'reinsurerPanel' });

  const totalAllocated =
    reinsurerPanelValues?.reduce(
      (sum, row) => sum + (typeof row.reinsurerShare === 'number' ? row.reinsurerShare : 0),
      0,
    ) ?? 0;

  const cap = maxShare ?? 0;
  const progressPct = cap > 0 ? Math.min((totalAllocated / cap) * 100, 100) : 0;
  const isExceeded = cap > 0 && totalAllocated > cap;
  const remaining = cap - totalAllocated;

  return (
    <div className="flex flex-col gap-4">
      {cap > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className={isExceeded ? 'text-red-500 font-medium' : 'text-gray-500'}>
              {totalAllocated}% of {cap}% allocated
            </span>
            <span className={isExceeded ? 'text-red-500 font-medium' : 'text-gray-400'}>
              {isExceeded ? `${Math.abs(remaining)}% over limit` : `${remaining}% remaining`}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                isExceeded ? 'bg-red-500' : progressPct >= 80 ? 'bg-green-400' : 'bg-blue-500',
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}
      {/* Dynamic reinsurer rows */}
      {fields.map((field, index) => {
        const rowErrors = errors.reinsurerPanel?.[index];
        return (
          <div
            key={field.id}
            className="flex flex-col gap-4 p-4 rounded-xl border border-gray-200 bg-gray-50"
          >
            {/* Row header */}
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Reinsurer {index + 1}
              </p>
              {fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                  aria-label="Remove reinsurer"
                >
                  <Icons.X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Reinsurer select */}
            <Controller
              name={`reinsurerPanel.${index}.reinsurer`}
              control={control}
              rules={{ required: 'Reinsurer is required' }}
              render={({ field: f }) => (
                <SearchSelect
                  label="Reinsurer"
                  placeholder="Select reinsurer…"
                  value={f.value}
                  onChange={f.onChange}
                  error={rowErrors?.reinsurer?.message}
                  options={reinsurerOptions}
                />
              )}
            />

            {/* Reinsurer share */}
            <FormField
              label="Reinsurer Share (%)"
              type="number"
              registration={register(`reinsurerPanel.${index}.reinsurerShare`, {
                required: 'Reinsurer share is required',
                min: { value: 0, message: 'Cannot be negative' },
                max: { value: 100, message: 'Cannot exceed 100%' },
                valueAsNumber: true,
              })}
              error={rowErrors?.reinsurerShare}
              placeholder="e.g. 25"
            />
          </div>
        );
      })}

      {/* Add Reinsurer button */}
      <button
        type="button"
        onClick={() => append({ ...DEFAULT_REINSURER_ROW })}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm font-medium text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
      >
        <Icons.Plus className="w-4 h-4" />
        Add Reinsurer
      </button>
    </div>
  );
}
