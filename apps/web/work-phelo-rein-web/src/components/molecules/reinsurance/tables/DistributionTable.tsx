'use client';

import { useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { Icons } from '@/components/atoms/icons';
import { TableButton } from '@/components/atoms/TableButton';
import { Facultative, PlacementParticipantStatus, toDisplayStatus } from '@/types/reinsurance';
import { OfferSlipPreviewModal } from '@/components/organisms/reinsurance/documents/OfferSlipPreviewModal';
import { useAnyPermissionRules } from '@/hooks/hr/usePermission';
import { RiPerm } from '@/lib/reinsurance/permissions';
import { cn } from '@/lib/utils';

export interface DistributionEntry {
  id: string; // participant record ID
  counterpartyId: string;
  reinsurerCompany: string;
  emails: string[];
  shareLine: number;
  brokerageFee: number;
  status: PlacementParticipantStatus;
  hasConfirmedClosing?: boolean;
}

const STATUS_VARIANT: Record<
  PlacementParticipantStatus,
  'warning' | 'success' | 'neutral' | 'danger'
> = {
  INVITED: 'neutral',
  OFFER_SENT: 'warning',
  QUOTED: 'warning',
  ACCEPTED: 'neutral',
  DECLINED: 'danger',
  CLOSED: 'success',
};

function statusLabel(status: PlacementParticipantStatus): string {
  return status
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function fmtAmount(val: number) {
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface DistributionTableProps {
  entries: DistributionEntry[];
  premium: number;
  placement: Facultative;
  isPlacementLocked?: boolean;
  busyIds?: Set<string>;
  onShareCommit: (row: DistributionEntry, share: number) => void;
  onBrokerageCommit: (row: DistributionEntry, brokerage: number) => void;
  onMailSent: (row: DistributionEntry) => void;
  onAccept: (row: DistributionEntry) => void;
  onDecline: (row: DistributionEntry) => void;
  onClose?: (row: DistributionEntry) => void;
  onDelete?: (row: DistributionEntry) => void;
  onRevert?: (row: DistributionEntry) => void;
  onReopen?: (row: DistributionEntry) => void;
}

export function DistributionTable({
  entries,
  premium,
  placement,
  isPlacementLocked = false,
  busyIds,
  onShareCommit,
  onBrokerageCommit,
  onMailSent,
  onAccept,
  onDecline,
  onClose,
  onDelete,
  onRevert,
  onReopen,
}: DistributionTableProps) {
  const canClosePlacement = useAnyPermissionRules(RiPerm.editParticipants);
  const [slipPreviewId, setSlipPreviewId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftShare, setDraftShare] = useState('');
  const [editingBrokerageId, setEditingBrokerageId] = useState<string | null>(null);
  const [draftBrokerage, setDraftBrokerage] = useState('');

  const startEdit = (row: DistributionEntry) => {
    setEditingId(row.id);
    setDraftShare(String(row.shareLine));
  };

  const commitEdit = (row: DistributionEntry) => {
    const parsed = parseFloat(draftShare);
    if (!isNaN(parsed)) {
      onShareCommit(row, Math.min(100, Math.max(0, parsed)));
    }
    setEditingId(null);
    setDraftShare('');
  };

  const startEditBrokerage = (row: DistributionEntry) => {
    setEditingBrokerageId(row.id);
    setDraftBrokerage(String(row.brokerageFee));
  };

  const commitBrokerage = (row: DistributionEntry) => {
    const parsed = parseFloat(draftBrokerage);
    if (!isNaN(parsed)) onBrokerageCommit(row, Math.min(100, Math.max(0, parsed)));
    setEditingBrokerageId(null);
    setDraftBrokerage('');
  };

  const columns: Column<DistributionEntry>[] = [
    {
      key: 'reinsurerCompany',
      label: 'Reinsurer Company',
      width: 'minmax(200px, 1fr)',
      render: (row) => <span className="font-medium text-gray-900">{row.reinsurerCompany}</span>,
    },
    {
      key: 'shareLine',
      label: 'Participant Share (%)',
      width: 'minmax(150px, 1fr)',
      render: (row) => {
        const isPaid =
          isPlacementLocked ||
          row.status === 'CLOSED' ||
          row.status === 'DECLINED' ||
          Boolean(row.hasConfirmedClosing);
        if (isPaid) return <span className="text-gray-700 text-sm">{row.shareLine}%</span>;
        const shareVariant =
          row.status === 'OFFER_SENT' ? 'red' : row.status === 'ACCEPTED' ? 'green' : 'default';
        return editingId === row.id ? (
          <input
            type="number"
            min={0}
            max={100}
            value={draftShare}
            onChange={(e) => setDraftShare(e.target.value)}
            onBlur={() => commitEdit(row)}
            onKeyDown={(e) => e.key === 'Enter' && commitEdit(row)}
            autoFocus
            className={cn(
              'w-20 px-2 py-1 text-sm border rounded-input bg-white focus:outline-none',
              shareVariant === 'red' && 'border-red-400 ring-1 ring-red-100 text-red-700',
              shareVariant === 'green' && 'border-green-400 ring-1 ring-green-100 text-green-700',
              shareVariant === 'default' && 'border-brand ring-1 ring-brand/20 text-gray-900',
            )}
          />
        ) : (
          <button
            type="button"
            onClick={() => startEdit(row)}
            className={cn(
              'w-20 flex items-center justify-between px-2 py-1 text-sm border rounded-input bg-white transition-colors',
              shareVariant === 'red' && 'border-red-300 text-red-700 hover:border-red-400',
              shareVariant === 'green' && 'border-green-300 text-green-700 hover:border-green-400',
              shareVariant === 'default' && 'border-gray-300 text-gray-700 hover:border-brand',
            )}
          >
            <span>{row.shareLine}%</span>
            <Icons.Pencil
              className={cn(
                'w-3 h-3 shrink-0',
                shareVariant === 'red' && 'text-red-400',
                shareVariant === 'green' && 'text-green-400',
                shareVariant === 'default' && 'text-gray-400',
              )}
            />
          </button>
        );
      },
    },
    {
      key: 'brokerageFee',
      label: 'Brokerage Fee (%)',
      width: 'minmax(150px, 1fr)',
      render: (row) => {
        const isPaid =
          isPlacementLocked ||
          row.status === 'CLOSED' ||
          row.status === 'DECLINED' ||
          Boolean(row.hasConfirmedClosing);
        if (isPaid) return <span className="text-gray-700 text-sm">{row.brokerageFee}%</span>;
        return editingBrokerageId === row.id ? (
          <input
            type="number"
            min={0}
            max={100}
            value={draftBrokerage}
            onChange={(e) => setDraftBrokerage(e.target.value)}
            onBlur={() => commitBrokerage(row)}
            onKeyDown={(e) => e.key === 'Enter' && commitBrokerage(row)}
            autoFocus
            className="w-20 px-2 py-1 text-sm border border-brand ring-1 ring-brand/20 rounded-input bg-white focus:outline-none text-gray-900"
          />
        ) : (
          <button
            type="button"
            onClick={() => startEditBrokerage(row)}
            className="w-20 flex items-center justify-between px-2 py-1 text-sm border border-gray-300 rounded-input bg-white text-gray-700 hover:border-brand transition-colors"
          >
            <span>{row.brokerageFee}%</span>
            <Icons.Pencil className="w-3 h-3 text-gray-400 shrink-0" />
          </button>
        );
      },
    },
    {
      key: 'premiumShare',
      label: 'Premium Share',
      width: '150px',
      render: (row) => (
        <span className="text-gray-700">{fmtAmount((row.shareLine / 100) * premium)}</span>
      ),
    },
    {
      key: 'brokerageAmount',
      label: 'Brokerage Amount',
      width: '150px',
      render: (row) => {
        const premiumShare = (row.shareLine / 100) * premium;
        return (
          <span className="text-gray-700">
            {fmtAmount((row.brokerageFee / 100) * premiumShare)}
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      width: '110px',
      render: (row) => (
        <Badge
          label={row.hasConfirmedClosing ? 'Closed' : statusLabel(row.status)}
          variant={row.hasConfirmedClosing ? 'success' : STATUS_VARIANT[row.status]}
        />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '150px',
      render: (row) => {
        const isFinalized = row.status === 'CLOSED' || Boolean(row.hasConfirmedClosing);
        const responded = row.status === 'DECLINED' || row.status === 'ACCEPTED' || isFinalized;
        const isBusy = busyIds?.has(row.id) ?? false;
        const disabledActionClass = isBusy ? 'opacity-50 cursor-wait' : '';
        const showPreviewIcon = row.status !== 'DECLINED' && !isFinalized;
        const showPreviewButton = isFinalized;
        const showMail =
          row.status !== 'OFFER_SENT' &&
          row.status !== 'QUOTED' &&
          row.status !== 'ACCEPTED' &&
          row.status !== 'DECLINED' &&
          !isFinalized;
        const showAccept =
          !isPlacementLocked &&
          (row.status === 'OFFER_SENT' || row.status === 'QUOTED') &&
          !responded;
        const showDecline =
          !isPlacementLocked &&
          (row.status === 'OFFER_SENT' || row.status === 'QUOTED') &&
          !responded;
        const showRevert = !isPlacementLocked && row.status === 'ACCEPTED' && !isFinalized;
        const showClose =
          !isPlacementLocked && row.status === 'ACCEPTED' && !isFinalized && canClosePlacement;
        const showReopen =
          !isPlacementLocked &&
          row.status === 'DECLINED' &&
          toDisplayStatus(placement.status) !== 'Closed';
        return (
          <div className="flex items-center gap-2">
            {showPreviewIcon && (
              <button
                type="button"
                title="Preview Slip"
                onClick={() => setSlipPreviewId(row.id)}
                className="text-blue-500 hover:text-blue-600 transition-colors"
              >
                <Icons.Eye className="w-5 h-5" />
              </button>
            )}
            {showPreviewButton && (
              <TableButton variant="blue" onClick={() => setSlipPreviewId(row.id)}>
                Preview Slip
              </TableButton>
            )}
            {showMail && (
              <TableButton
                variant="green"
                tooltip="Mark as offer sent"
                isLoading={isBusy}
                onClick={() => {
                  if (!isBusy) onMailSent(row);
                }}
              >
                Send Mail
              </TableButton>
            )}
            {showAccept && (
              <button
                type="button"
                title={isBusy ? 'Accepting line...' : 'Accept Offer'}
                onClick={() => {
                  if (!isBusy) onAccept(row);
                }}
                disabled={isBusy}
                className={`text-green-500 hover:text-green-600 transition-colors ${disabledActionClass}`}
              >
                <Icons.Check className="w-5 h-5" />
              </button>
            )}
            {showDecline && (
              <button
                type="button"
                title="Decline Offer"
                onClick={() => {
                  if (!isBusy) onDecline(row);
                }}
                disabled={isBusy}
                className={`text-red-400 hover:text-red-600 transition-colors ${disabledActionClass}`}
              >
                <Icons.X className="w-5 h-5" />
              </button>
            )}
            {showReopen && (
              <button
                type="button"
                title={isBusy ? 'Reopening...' : 'Reopen'}
                onClick={() => {
                  if (!isBusy) onReopen?.(row);
                }}
                disabled={isBusy}
                className={`text-amber-500 hover:text-amber-600 transition-colors ${disabledActionClass}`}
              >
                <Icons.RotateCcw className="w-5 h-5" />
              </button>
            )}
            {showRevert && (
              <button
                type="button"
                title="Revert to pending"
                onClick={() => {
                  if (!isBusy) onRevert?.(row);
                }}
                disabled={isBusy}
                className={`text-amber-500 hover:text-amber-600 transition-colors ${disabledActionClass}`}
              >
                <Icons.RotateCcw className="w-5 h-5" />
              </button>
            )}
            {showClose && (
              <TableButton
                isLoading={isBusy}
                variant="red"
                tooltip="Validate to close the offer"
                onClick={() => {
                  if (!isBusy) onClose?.(row);
                }}
              >
                Close
              </TableButton>
            )}
            {!responded && row.status !== 'QUOTED' && row.status !== 'OFFER_SENT' && (
              <button
                type="button"
                title="Delete"
                onClick={() => {
                  if (!isBusy) onDelete?.(row);
                }}
                disabled={isBusy}
                className={`text-red-400 hover:text-red-600 transition-colors ${disabledActionClass}`}
              >
                <Icons.Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  const slipPreviewEntry = entries.find((e) => e.id === slipPreviewId);

  return (
    <>
      <DataTable
        columns={columns}
        data={entries}
        emptyMessage="No distribution entries yet"
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        noInternalScroll
      />

      <OfferSlipPreviewModal
        isOpen={!!slipPreviewId}
        placement={placement}
        brokerageFee={slipPreviewEntry?.brokerageFee ?? 0}
        counterpartyId={slipPreviewEntry?.counterpartyId}
        onClose={() => setSlipPreviewId(null)}
      />
    </>
  );
}
