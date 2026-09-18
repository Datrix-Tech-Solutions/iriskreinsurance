'use client';

import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { Icons } from '@/components/atoms/icons';
import { cn } from '@/lib/utils';
import {
  ENDORSEMENT_TYPE_LABELS,
  PlacementDocument,
  PlacementEndorsement,
} from '@/types/reinsurance';
import { fmtDate } from './formatters';

interface EndorsementHeaderProps {
  endorsement: PlacementEndorsement;
  displayedStatusLabel: string;
  displayedStatusVariant: 'neutral' | 'warning' | 'success' | 'danger';
  isUpdatingStatus: boolean;
  isOpen: boolean;
  /** Gates the workflow buttons (Edit, Send to Market). Read-only actions stay. */
  canManage: boolean;
  onEdit: () => void;
  onSendToMarket: () => void;
  endorsementSlipDocument: PlacementDocument | undefined;
  onViewEndorsementSlip: () => void;
}

export function EndorsementHeader({
  endorsement,
  displayedStatusLabel,
  displayedStatusVariant,
  isUpdatingStatus,
  isOpen,
  canManage,
  onEdit,
  onSendToMarket,
  endorsementSlipDocument,
  onViewEndorsementSlip,
}: EndorsementHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-gray-900">{endorsement.endorsementNumber}</span>
        <Badge label={ENDORSEMENT_TYPE_LABELS[endorsement.type]} variant="neutral" />
        <Badge label={displayedStatusLabel} variant={displayedStatusVariant} />
        <span className="text-xs text-gray-400">{fmtDate(endorsement.effectiveDate)}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {endorsement.status === 'DRAFT' && canManage && (
            <>
              <Button size="sm" variant="outline" onClick={onEdit}>
                Edit
              </Button>
              <Button size="sm" isLoading={isUpdatingStatus} onClick={onSendToMarket}>
                Send to Market
              </Button>
            </>
          )}
          {endorsement.status === 'CLOSED' && (
            <Button size="sm" variant="secondary" onClick={onViewEndorsementSlip}>
              {endorsementSlipDocument ? 'View Endorsement Slip' : 'Preview Endorsement Slip'}
            </Button>
          )}
        </div>
        <span title="Toggle endorsement details">
          <Icons.ChevronDown
            className={cn(
              'w-4 h-4 text-gray-400 shrink-0 transition-transform duration-600',
              isOpen && 'rotate-180',
            )}
          />
        </span>
      </div>
    </div>
  );
}
