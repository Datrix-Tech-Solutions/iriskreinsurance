'use client';

import { DatePicker } from '@/components/atoms/DatePicker';

interface Props {
  dateFilter: string;
  onDateChange: (v: string) => void;
  showClear: boolean;
  onClear: () => void;
}

export function AppointmentFilterBar({ dateFilter, onDateChange, showClear, onClear }: Props) {
  return (
    <>
      <div className="w-44">
        <DatePicker placeholder="Filter by date" value={dateFilter} onChange={onDateChange} />
      </div>
      {showClear && (
        <button
          type="button"
          onClick={onClear}
          className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          Clear filters
        </button>
      )}
    </>
  );
}
