'use client';

import { ArrowLeft, ArrowRight } from 'lucide-react';
import { ProspectBreadcrumb } from '@/components/molecules/marketing/ProspectBreadcrumb';
import { StepProgressBar } from '@/components/atoms/StepProgressBar';
import { Button } from '@/components/atoms/Button';
import { pagePx } from '@/lib/layout';

interface ProspectFormLayoutProps {
  steps: string[];
  currentStep: number;
  tenantSlug: string;
  prospectName: string;
  onNext: () => void;
  onBack?: () => void;
  onCancel: () => void;
  nextLabel?: string;
  isLoading?: boolean;
  children: React.ReactNode;
}

export function ProspectFormLayout({
  steps,
  currentStep,
  tenantSlug,
  prospectName,
  onNext,
  onBack,
  onCancel,
  nextLabel = 'Next',
  isLoading,
  children,
}: ProspectFormLayoutProps) {
  const isFirstStep = currentStep === 0;

  return (
    <div className="flex-1 min-h-0 flex flex-col relative">
      {/* Pinned header */}
      <div className={`shrink-0 bg-gray-50 flex flex-col gap-4 ${pagePx} pt-4 pb-4`}>
        <ProspectBreadcrumb tenantSlug={tenantSlug} prospectName={prospectName} />
        <StepProgressBar steps={steps} currentStep={currentStep} />
      </div>

      {/* Scrollable content */}
      <div className={`flex-1 min-h-0 overflow-y-auto ${pagePx} pt-4 pb-24`}>{children}</div>

      {/* Glass footer */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-10 backdrop-blur-xs bg-white/10 border-t border-white/50 ${pagePx} pt-4 pb-6 sm:pb-8`}
      >
        <div className="flex items-center justify-end gap-3">
          {isFirstStep ? (
            <Button variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
          ) : (
            <Button variant="outline" onClick={onBack} disabled={isLoading} className="group">
              <span className="inline-flex overflow-hidden w-0 group-hover:w-4 group-hover:mr-1.5 transition-[width,margin] duration-300 ease-out">
                <ArrowLeft className="w-4 h-4 shrink-0 translate-x-4 group-hover:translate-x-0 transition-transform duration-300 ease-out" />
              </span>
              Previous
            </Button>
          )}
          <Button icon={<ArrowRight className="w-4 h-4" />} onClick={onNext} isLoading={isLoading}>
            {nextLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
