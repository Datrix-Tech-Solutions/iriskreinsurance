'use client';

import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { inputClass } from '@/lib/utils';

export interface NewAppointmentFields {
  prospectName: string;
  date: string;
  startTime: string;
  endTime: string;
  manager: string;
  comment: string;
}

export type NewAppointmentErrors = Partial<Record<keyof NewAppointmentFields, string>>;

interface Props {
  values: NewAppointmentFields;
  onChange: (values: NewAppointmentFields) => void;
  errors?: NewAppointmentErrors;
  prospectOptions?: SearchSelectOption[];
  managerOptions?: SearchSelectOption[];
}

export function NewAppointmentForm({
  values,
  onChange,
  errors,
  prospectOptions = [],
  managerOptions = [],
}: Props) {
  function set<K extends keyof NewAppointmentFields>(key: K, val: string) {
    onChange({ ...values, [key]: val });
  }

  return (
    <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
      <SearchSelect
        label="Prospect Name"
        placeholder="Select a prospect"
        options={prospectOptions}
        value={values.prospectName}
        onChange={(v) => set('prospectName', v)}
        error={errors?.prospectName}
      />

      <DatePicker
        label="Date"
        value={values.date}
        onChange={(v) => set('date', v)}
        error={errors?.date}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">Start Time</label>
          <input
            type="time"
            value={values.startTime}
            onChange={(e) => set('startTime', e.target.value)}
            className={inputClass(errors?.startTime)}
          />
          {errors?.startTime && <p className="text-xs text-red-500">{errors.startTime}</p>}
        </div>
        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">End Time</label>
          <input
            type="time"
            value={values.endTime}
            onChange={(e) => set('endTime', e.target.value)}
            className={inputClass(errors?.endTime)}
          />
          {errors?.endTime && <p className="text-xs text-red-500">{errors.endTime}</p>}
        </div>
      </div>

      <SearchSelect
        label="Manager"
        placeholder="Select a manager"
        options={managerOptions}
        value={values.manager}
        onChange={(v) => set('manager', v)}
        error={errors?.manager}
      />

      <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
        <label className="text-sm font-bold text-gray-900">Comment</label>
        <textarea
          rows={4}
          placeholder="Additional notes for this appointment..."
          value={values.comment}
          onChange={(e) => set('comment', e.target.value)}
          className={inputClass(errors?.comment, 'resize-none')}
        />
        {errors?.comment && <p className="text-xs text-red-500">{errors.comment}</p>}
      </div>
    </div>
  );
}
