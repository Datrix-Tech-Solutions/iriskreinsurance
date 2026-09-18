'use client';

import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { TableButton } from '@/components/atoms/TableButton';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import {
  EndorsementParticipantClosing,
  PlacementEndorsementParticipant,
} from '@/types/reinsurance';
import { EndorsementParticipantRow } from './types';

// A counterparty can briefly have two endorsement participant records (the
// preserved DECLINED row plus a fresh one from reinvite) — an exact
// participantId match must win over a counterpartyId fallback, otherwise
// `.find` returns whichever record happens to come first in the list.
function findRowParticipant(
  endorsementParticipants: PlacementEndorsementParticipant[],
  row: EndorsementParticipantRow,
): PlacementEndorsementParticipant | undefined {
  if (row.participantId) {
    return endorsementParticipants.find((item) => item.id === row.participantId);
  }
  return endorsementParticipants.find((item) => item.counterpartyId === row.counterpartyId);
}

interface EndorsementParticipantsTableProps {
  rows: EndorsementParticipantRow[];
  endorsementParticipants: PlacementEndorsementParticipant[];
  isEndorsementClosed: boolean;
  acceptedCounterpartyIds: Set<string>;
  /** Counterparties an accepted-but-unvalidated row was reopened for editing (client-only, no status change). */
  editingCounterpartyIds: Set<string>;
  confirmedClosingByEndorsementParticipantId: Record<string, EndorsementParticipantClosing>;
  busyEPIds: Set<string>;
  mailedIds: Set<string>;
  revisedShares: Record<string, string>;
  onRevisedShareChange: (counterpartyId: string, value: string) => void;
  hasAvailableCapacity: boolean;
  /** Endorsement workflow permission — hides the Actions column and Add button. */
  canManage: boolean;
  onAddParticipant: () => void;
  onPreviewMarketDocument: (row: EndorsementParticipantRow) => void;
  onMailReinsurer: (counterpartyId: string) => void;
  onAccept: (row: EndorsementParticipantRow) => void;
  onReject: (row: EndorsementParticipantRow) => void;
  onEditRevision: (row: EndorsementParticipantRow) => void;
  onReopen: (row: EndorsementParticipantRow) => void;
  onValidate: (row: EndorsementParticipantRow) => void;
  onViewClosing: (closing: EndorsementParticipantClosing) => void;
  onViewCertificate: (
    row: EndorsementParticipantRow,
    closing: EndorsementParticipantClosing,
  ) => void;
}

export function EndorsementParticipantsTable({
  rows,
  endorsementParticipants,
  isEndorsementClosed,
  acceptedCounterpartyIds,
  editingCounterpartyIds,
  confirmedClosingByEndorsementParticipantId,
  busyEPIds,
  mailedIds,
  revisedShares,
  onRevisedShareChange,
  hasAvailableCapacity,
  canManage,
  onAddParticipant,
  onPreviewMarketDocument,
  onMailReinsurer,
  onAccept,
  onReject,
  onEditRevision,
  onReopen,
  onValidate,
  // onViewClosing,
  onViewCertificate,
}: EndorsementParticipantsTableProps) {
  const columns: Column<EndorsementParticipantRow>[] = [
    {
      key: 'reinsurerName',
      label: 'Reinsurer',
      width: 'minmax(200px, 1fr)',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-gray-900">{row.reinsurerName}</span>
          <Badge label={row.isNew ? 'Added' : 'Endorsed'} variant="neutral" />
        </div>
      ),
    },
    {
      key: 'originalShare',
      label: 'Original',
      width: '100px',
      render: (row) => (
        <span className="text-gray-700">{row.isNew ? '—' : `${row.originalShare}%`}</span>
      ),
    },
    {
      key: 'counterpartyId',
      label: 'Revised',
      width: '100px',
      render: (row) => {
        const isAccepted =
          acceptedCounterpartyIds.has(row.counterpartyId) &&
          !editingCounterpartyIds.has(row.counterpartyId);
        if (isAccepted) {
          const ep = findRowParticipant(endorsementParticipants, row);
          return (
            <span className="text-gray-700">
              {parseFloat(ep?.signedLinePercent ?? ep?.sharePercent ?? String(row.originalShare))}%
            </span>
          );
        }
        const endorsementParticipant = findRowParticipant(endorsementParticipants, row);
        if (endorsementParticipant?.status === 'DECLINED') {
          return <span className="text-gray-400">0%</span>;
        }
        const mailed = mailedIds.has(row.counterpartyId);
        if (!canManage) {
          return (
            <span className="text-gray-700">
              {revisedShares[row.counterpartyId] ?? String(row.offeredShare)}%
            </span>
          );
        }
        return (
          <input
            type="number"
            min={0}
            max={100}
            value={revisedShares[row.counterpartyId] ?? String(row.offeredShare)}
            onChange={(e) => onRevisedShareChange(row.counterpartyId, e.target.value)}
            onBlur={(e) => {
              const parsed = parseFloat(e.target.value);
              if (Number.isNaN(parsed)) return;
              const clamped = Math.min(100, Math.max(0, parsed));
              if (clamped !== parsed) onRevisedShareChange(row.counterpartyId, String(clamped));
            }}
            className={
              mailed
                ? 'w-20 px-2 py-1 text-sm border border-red-400 ring-1 ring-red-100 rounded bg-white text-red-700 focus:outline-none focus:border-red-500'
                : 'w-20 px-2 py-1 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:border-brand'
            }
          />
        );
      },
    },
    {
      key: 'netPremium',
      label: 'Net Premium',
      width: '150px',
      render: (row) => {
        const endorsementParticipant = findRowParticipant(endorsementParticipants, row);
        if (endorsementParticipant?.status === 'DECLINED') {
          return (
            <span className="text-gray-400">
              {(0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          );
        }
        const confirmedClosing = row.participantId
          ? confirmedClosingByEndorsementParticipantId[row.participantId]
          : undefined;
        if (!confirmedClosing) {
          return <span className="text-xs text-gray-400">Awaiting Validation</span>;
        }
        const netPremium =
          confirmedClosing.netPremium === null ? null : Number(confirmedClosing.netPremium);
        return (
          <span className="text-gray-700">
            {confirmedClosing.currency ? `${confirmedClosing.currency} ` : ''}
            {netPremium !== null && Number.isFinite(netPremium)
              ? netPremium.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : '—'}
          </span>
        );
      },
    },
    {
      key: 'response',
      label: 'Response',
      width: '100px',
      render: (row) => {
        const endorsementParticipant = findRowParticipant(endorsementParticipants, row);
        if (endorsementParticipant?.status === 'DECLINED') {
          return <Badge label="Declined" variant="danger" />;
        }
        if (
          endorsementParticipant?.status === 'ACCEPTED' ||
          endorsementParticipant?.status === 'CLOSED'
        ) {
          return <Badge label="Accepted" variant="success" />;
        }
        if (endorsementParticipant?.status === 'OFFER_SENT') {
          return <Badge label="Sent" variant="warning" />;
        }
        return <span className="text-xs text-gray-400">Awaiting</span>;
      },
    },
    ...(canManage
      ? [
          {
            key: 'id',
            label: 'Actions',
            width: 'minmax(200px, 1fr)',
            render: (row: EndorsementParticipantRow) => {
              const endorsementParticipant = findRowParticipant(endorsementParticipants, row);
              // The real backend status — never overridden by the local "editing"
              // flag. Actions that require a specific backend transition (like
              // Decline, which only exists from INVITED/OFFER_SENT/QUOTED) must be
              // gated on this, not on the edit-mode-aware `isAccepted` below,
              // otherwise editing an already-accepted offer would let you try to
              // decline a participant the backend still considers ACCEPTED.
              const isActuallyAccepted =
                endorsementParticipant?.status === 'ACCEPTED' ||
                endorsementParticipant?.status === 'CLOSED';
              const isEditingRevision =
                endorsementParticipant?.status === 'ACCEPTED' &&
                editingCounterpartyIds.has(row.counterpartyId);
              const isAccepted = isActuallyAccepted && !isEditingRevision;
              const isDeclined = endorsementParticipant?.status === 'DECLINED';
              const isValidated = row.participantId
                ? Boolean(confirmedClosingByEndorsementParticipantId[row.participantId])
                : false;
              const confirmedClosing = row.participantId
                ? confirmedClosingByEndorsementParticipantId[row.participantId]
                : undefined;
              const isBusy = busyEPIds.has(row.counterpartyId);
              const mailed = mailedIds.has(row.counterpartyId);

              if (confirmedClosing) {
                return (
                  <div className="flex flex-wrap items-center gap-2">
                    {/* <TableButton variant="green" onClick={() => onViewClosing(confirmedClosing)}>
                View Closing
              </TableButton> */}
                    {!row.isNew && (
                      <TableButton
                        variant="blue"
                        isLoading={isBusy}
                        onClick={() => {
                          if (!isBusy) onViewCertificate(row, confirmedClosing);
                        }}
                      >
                        Certificate
                      </TableButton>
                    )}
                  </div>
                );
              }

              if (row.isNew) {
                // Whether the backend has a final answer already (accepted or
                // declined) — used to gate Decline, which is never valid once a
                // participant has actually responded, edit mode or not.
                const hasResponded = isActuallyAccepted || isDeclined;
                return (
                  <div className="flex items-center gap-2">
                    {!isEndorsementClosed && (
                      <TableButton variant="gray" onClick={() => onPreviewMarketDocument(row)}>
                        Offer Slip
                      </TableButton>
                    )}
                    {!mailed && !hasResponded && (
                      <TableButton
                        variant="green"
                        onClick={() => onMailReinsurer(row.counterpartyId)}
                      >
                        Send Mail
                      </TableButton>
                    )}
                    {mailed && (!hasResponded || isEditingRevision) && (
                      <TableButton
                        variant="green"
                        isLoading={isBusy}
                        onClick={() => {
                          if (!isBusy) onAccept(row);
                        }}
                      >
                        Accept
                      </TableButton>
                    )}
                    {mailed && !hasResponded && (
                      <TableButton
                        variant="red"
                        isLoading={isBusy}
                        onClick={() => {
                          if (!isBusy) onReject(row);
                        }}
                      >
                        Decline
                      </TableButton>
                    )}
                    {isDeclined && !isEndorsementClosed && (
                      <TableButton
                        variant="orange"
                        isLoading={isBusy}
                        tooltip="Re-invite this reinsurer"
                        onClick={() => {
                          if (!isBusy) onReopen(row);
                        }}
                      >
                        Reinvite
                      </TableButton>
                    )}
                    {isAccepted &&
                      (isValidated ? (
                        <Badge label="Confirmed" variant="success" />
                      ) : (
                        <>
                          <TableButton
                            isLoading={isBusy}
                            tooltip="Validate endorsement closing"
                            onClick={() => {
                              if (!isBusy) onValidate(row);
                            }}
                          >
                            Validate
                          </TableButton>
                          <TableButton
                            variant="orange"
                            isLoading={isBusy}
                            tooltip="Edit revised offer"
                            onClick={() => {
                              if (!isBusy) onEditRevision(row);
                            }}
                          >
                            Change Offer
                          </TableButton>
                        </>
                      ))}
                  </div>
                );
              }

              return (
                <div className="flex items-center gap-2">
                  <TableButton variant="gray" onClick={() => onPreviewMarketDocument(row)}>
                    Endorsement
                  </TableButton>
                  {isAccepted ? (
                    isValidated ? (
                      <Badge label="Confirmed" variant="success" />
                    ) : (
                      <>
                        <TableButton
                          isLoading={isBusy}
                          tooltip="Validate endorsement closing"
                          onClick={() => {
                            if (!isBusy) onValidate(row);
                          }}
                        >
                          Validate
                        </TableButton>
                        <TableButton
                          variant="orange"
                          isLoading={isBusy}
                          tooltip="Edit revised offer"
                          onClick={() => {
                            if (!isBusy) onEditRevision(row);
                          }}
                        >
                          Change Offer
                        </TableButton>
                      </>
                    )
                  ) : isDeclined ? null : (
                    <>
                      {!mailed && (
                        <TableButton
                          variant="green"
                          tooltip="Send Endorsement Email"
                          onClick={() => onMailReinsurer(row.counterpartyId)}
                        >
                          Send Mail
                        </TableButton>
                      )}
                      {mailed && (
                        <TableButton
                          variant="green"
                          isLoading={isBusy}
                          onClick={() => {
                            if (!isBusy) onAccept(row);
                          }}
                        >
                          Accept
                        </TableButton>
                      )}
                    </>
                  )}
                </div>
              );
            },
          } as Column<EndorsementParticipantRow>,
        ]
      : []),
  ];

  return (
    <section className="flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Endorsement Participants
          </p>
        </div>
        {hasAvailableCapacity && canManage && (
          <Button size="sm" onClick={onAddParticipant}>
            Add Endorsement Participant
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        data={rows}
        emptyMessage="No endorsement reinsurers recorded"
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        noInternalScroll
      />
    </section>
  );
}
