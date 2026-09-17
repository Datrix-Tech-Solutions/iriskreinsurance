'use client';

import { useState } from 'react';
import { MultiSelect, MultiSelectOption } from '@/components/atoms/MultiSelect';
import { Button } from '@/components/atoms/Button';
import { Icons } from '@/components/atoms/icons';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS: MultiSelectOption[] = Array.from({ length: 8 }, (_, i) => {
  const year = String(CURRENT_YEAR - i);
  return { value: year, label: year };
});

interface ReportFilterFormProps {
  onGenerate: (years: string[]) => void;
}

export function ReportFilterForm({ onGenerate }: ReportFilterFormProps) {
  const [years, setYears] = useState<string[]>([]);

  const removeYear = (year: string) => setYears((prev) => prev.filter((y) => y !== year));

  return (
    <div className="flex flex-col gap-5 flex-1">
      <div className="flex-1 flex flex-col gap-3">
        <MultiSelect
          label="Fiscal Year"
          placeholder="Select year(s)…"
          options={YEAR_OPTIONS}
          value={years}
          onChange={setYears}
          hideChips
        />

        {years.length > 0 && (
          <div className="flex flex-col gap-2">
            {years.map((year) => (
              <div
                key={year}
                className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 flex items-center justify-between"
              >
                <span className="text-sm font-semibold text-gray-900">{year}</span>
                <button
                  type="button"
                  onClick={() => removeYear(year)}
                  className="text-gray-400 hover:text-red-400 transition-colors"
                >
                  <Icons.X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button className="w-full" disabled={years.length === 0} onClick={() => onGenerate(years)}>
        Generate Report
      </Button>
    </div>
  );
}
