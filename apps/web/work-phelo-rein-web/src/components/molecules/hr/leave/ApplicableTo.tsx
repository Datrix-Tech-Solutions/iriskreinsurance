'use client';

import { cn } from '@/lib/utils';
import { Icons } from '@/components/atoms/icons';
import { MinusIcon } from 'lucide-react';
import { LeaveApplicableTo } from '@/types/hr';

const EMPLOYMENT_TYPES: { value: LeaveApplicableTo; label: string }[] = [
  { value: 'FULL_TIME', label: 'Full Time' },
  { value: 'PART_TIME', label: 'Part Time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERN', label: 'Intern' },
];

const ALL_SPECIFIC = EMPLOYMENT_TYPES.map((t) => t.value);

interface ApplicableToProps {
  selected: LeaveApplicableTo[];
  onChange: (next: LeaveApplicableTo[]) => void;
}

export function ApplicableTo({ selected, onChange }: ApplicableToProps) {
  const allChecked = ALL_SPECIFIC.every((t) => selected.includes(t));
  const someChecked = selected.length > 0 && !allChecked;

  const toggleAll = () => {
    if (allChecked) {
      onChange([]);
    } else {
      onChange(['ALL', ...ALL_SPECIFIC] as LeaveApplicableTo[]);
    }
  };

  const toggleType = (type: LeaveApplicableTo) => {
    let next: LeaveApplicableTo[];
    if (selected.includes(type)) {
      next = selected.filter((t) => t !== type && t !== 'ALL');
    } else {
      const withNew = [...selected.filter((t) => t !== 'ALL'), type];
      const allNowSelected = ALL_SPECIFIC.every((t) => withNew.includes(t));
      next = allNowSelected ? (['ALL', ...ALL_SPECIFIC] as LeaveApplicableTo[]) : withNew;
    }
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <span className="text-sm font-medium text-gray-900">Applicable to</span>
        <p className="text-xs text-gray-400 mt-0.5">
          Select which employment types this leave applies to
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          className={cn(
            'relative flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors',
            allChecked || someChecked
              ? 'border-gray-400 bg-white'
              : 'border-gray-200 bg-white hover:border-gray-300',
          )}
        >
          <span
            className={cn(
              'w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors',
              allChecked || someChecked ? 'bg-brand border-brand' : 'border-gray-300 bg-white',
            )}
          >
            {allChecked && <Icons.Check className="w-2.5 h-2.5 text-white stroke-3" />}
            {someChecked && <MinusIcon className="w-2.5 h-2.5 text-white stroke-3" />}
          </span>
          <span className="text-sm font-medium text-gray-900">All employees</span>
          <input
            type="checkbox"
            className="absolute inset-0 opacity-0 cursor-pointer"
            checked={allChecked}
            onChange={toggleAll}
          />
        </label>

        <div className="flex flex-col gap-1.5 pl-2.5 border-l-2 border-gray-100 ml-1.5">
          {EMPLOYMENT_TYPES.map(({ value, label }) => {
            const on = selected.includes(value);
            return (
              <label
                key={value}
                className={cn(
                  'relative flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors',
                  on
                    ? 'border-gray-400 bg-white'
                    : 'border-gray-200 bg-white hover:border-gray-300',
                )}
              >
                <span
                  className={cn(
                    'w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors',
                    on ? 'bg-brand border-brand' : 'border-gray-300 bg-white',
                  )}
                >
                  {on && <Icons.Check className="w-2.5 h-2.5 text-white stroke-3" />}
                </span>
                <span className="text-sm text-gray-700">{label}</span>
                <input
                  type="checkbox"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  checked={on}
                  onChange={() => toggleType(value)}
                />
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { ALL_SPECIFIC, EMPLOYMENT_TYPES };
