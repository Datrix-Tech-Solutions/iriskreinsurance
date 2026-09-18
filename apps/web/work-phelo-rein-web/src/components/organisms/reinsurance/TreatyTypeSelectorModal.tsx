'use client';

import { Percent, Layers, FileCheck2, ShieldAlert } from 'lucide-react';
import { Modal } from '@/components/organisms/shared/Modal';
import { TreatyType, TREATY_TYPES } from '@/types/reinsurance';
import { cn } from '@/lib/utils';

const TYPE_META: Record<TreatyType, { icon: React.ElementType; description: string }> = {
  'Quota Share': {
    icon: Percent,
    description: 'Share a fixed percentage of all risks and premiums with your reinsurer.',
  },
  Surplus: {
    icon: Layers,
    description: 'Cede only the portion of risk that exceeds your own retention limit.',
  },
  'Fac. Obligatory Treaty': {
    icon: FileCheck2,
    description:
      'Reinsurer is obligated to accept all eligible risks ceded under the treaty terms.',
  },
  'Excess of Loss': {
    icon: ShieldAlert,
    description: 'Reinsurer covers losses that exceed a defined retention layer per event or risk.',
  },
};

interface TreatyTypeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: TreatyType) => void;
}

export function TreatyTypeSelectorModal({
  isOpen,
  onClose,
  onSelect,
}: TreatyTypeSelectorModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select Treaty Type"
      description="Choose the type of reinsurance treaty you want to register."
      width="max-w-lg"
    >
      <div className="grid grid-cols-2 gap-3 mt-5">
        {TREATY_TYPES.map((type) => {
          const { icon: Icon, description } = TYPE_META[type];
          return (
            <button
              key={type}
              type="button"
              onClick={() => onSelect(type)}
              className={cn(
                'flex flex-col items-start gap-3 rounded-xl border border-gray-200 p-4 text-left',
                'transition-all hover:border-brand hover:bg-brand-tint hover:shadow-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              )}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-gray-900">{type}</p>
                <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
