'use client';

import { inputClass } from '@/lib/utils';

export interface SalesPipelineStageFields {
  name: string;
  probability: string;
}

interface Props {
  values: SalesPipelineStageFields;
  onChange: (values: SalesPipelineStageFields) => void;
  errors?: Partial<SalesPipelineStageFields>;
}

export function SalesPipelineStageForm({ values, onChange, errors }: Props) {
  return (
    <div className="flex flex-col gap-(--field-stack-gap,0.75rem) pt-2">
      <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
        <label className="text-sm font-bold text-gray-900">Stage Name</label>
        <input
          type="text"
          placeholder="e.g. Not Interested"
          value={values.name}
          onChange={(e) => onChange({ ...values, name: e.target.value })}
          className={inputClass(errors?.name)}
        />
        {errors?.name && <p className="text-xs text-red-500">{errors.name}</p>}
      </div>

      <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
        <label className="text-sm font-bold text-gray-900">
          Probability of Achieving Sales (%)
        </label>
        <input
          type="number"
          min={0}
          max={100}
          placeholder="0"
          value={values.probability}
          onChange={(e) => onChange({ ...values, probability: e.target.value })}
          className={inputClass(errors?.probability)}
        />
        {errors?.probability && <p className="text-xs text-red-500">{errors.probability}</p>}
      </div>
    </div>
  );
}
