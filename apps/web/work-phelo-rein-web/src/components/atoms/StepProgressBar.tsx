'use client';

import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepProgressBarProps {
  steps: string[];
  currentStep: number; // 0-indexed
}

export function StepProgressBar({ steps, currentStep }: StepProgressBarProps) {
  const progressPct = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Mobile — compact pill */}
      <div className="md:hidden px-5 py-4 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">{steps[currentStep]}</span>
          <span className="text-xs text-gray-400">
            Step {currentStep + 1} of {steps.length}
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-(--module-btn-bg,var(--color-brand)) transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between pt-0.5">
          {currentStep > 0 ? (
            <span className="flex items-center gap-0.5 text-xs text-gray-400 truncate max-w-[45%]">
              <ChevronLeft className="w-3 h-3 shrink-0" />
              <span className="truncate">{steps[currentStep - 1]}</span>
            </span>
          ) : (
            <span />
          )}
          {currentStep < steps.length - 1 ? (
            <span className="flex items-center gap-0.5 text-xs text-gray-400 truncate max-w-[45%]">
              <span className="truncate">{steps[currentStep + 1]}</span>
              <ChevronRight className="w-3 h-3 shrink-0" />
            </span>
          ) : (
            <span />
          )}
        </div>
      </div>

      {/* Desktop — full circles + labels */}
      <div className="hidden md:block px-8 py-5">
        <div className="flex items-center">
          {steps.map((label, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;

            return (
              <div key={label} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="relative w-8 h-8 shrink-0">
                    {isCurrent && (
                      <span className="absolute inset-0 rounded-full bg-(--module-btn-bg,var(--color-brand)) opacity-60 animate-ping" />
                    )}
                    <div
                      className={cn(
                        'relative w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                        isCompleted
                          ? 'bg-(--module-btn-bg,var(--color-brand))'
                          : isCurrent
                            ? 'bg-white border-2 border-gray-300'
                            : 'bg-gray-200',
                      )}
                    >
                      {isCompleted ? (
                        <Check className="w-4 h-4 text-white stroke-[2.5]" />
                      ) : isCurrent ? (
                        <span className="relative w-2 h-2 rounded-full bg-gray-500">
                          <span className="absolute inset-0 rounded-full bg-gray-500 opacity-75 animate-ping" />
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span
                    className={cn(
                      'text-xs whitespace-nowrap',
                      isCurrent || isCompleted ? 'text-gray-900 font-semibold' : 'text-gray-400',
                    )}
                  >
                    {label}
                  </span>
                </div>

                {index < steps.length - 1 && <div className="flex-1 h-0.5 bg-gray-200 mx-3 mb-5" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
