'use client';

import { useMemo, useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { TableButton } from '@/components/atoms/TableButton';
import { EndorsedReferencePill } from '@/components/atoms/EndorsedReferencePill';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Badge } from '@/components/atoms/Badge';
import { useFacultatives, useAllReinsurerClaims, RecoveryRow } from '@/hooks';
import { RecordRecoveryReceiptModal } from '@/components/organisms/reinsurance/RecordRecoveryReceiptModal';
import { PlacementClaimRecoveryStatus } from '@/types/reinsurance';

const PAGE_SIZE = 10;

function fmtAmount(val: number, currency: string) {
  return `${currency} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const RECOVERY_STATUS_LABEL: Record<PlacementClaimRecoveryStatus, string> = {
  UNRECOVERED: 'Unrecovered',
  PARTIALLY_RECOVERED: 'Partially Recovered',
  FULLY_RECOVERED: 'Fully Recovered',
};

const RECOVERY_STATUS_VARIANT: Record<
  PlacementClaimRecoveryStatus,
  'success' | 'warning' | 'neutral'
> = {
  UNRECOVERED: 'neutral',
  PARTIALLY_RECOVERED: 'warning',
  FULLY_RECOVERED: 'success',
};

type RecoveryTableRow = RecoveryRow;

export function RecoveriesTable() {
  const [search, setSearch] = useState('');
  const [reinsurerFilter, setReinsurerFilter] = useState('');
  const [page, setPage] = useState(1);
  const [paymentRow, setPaymentRow] = useState<RecoveryTableRow | null>(null);

  const { data: allPlacements = [], isLoading: loadingPlacements } = useFacultatives();

  const reinsuredPlacements = useMemo(
    () =>
      allPlacements.filter((p) =>
        p.participants.some((pt) => pt.status === 'ACCEPTED' || pt.status === 'CLOSED'),
      ),
    [allPlacements],
  );

  const { rows, isLoading: loadingClaims } = useAllReinsurerClaims(reinsuredPlacements);

  const isLoading = loadingPlacements || loadingClaims;

  const recoveryRows: RecoveryTableRow[] = useMemo(() => rows, [rows]);

  const reinsurerOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of recoveryRows) seen.set(r.reinsurerId, r.reinsurerName);
    return Array.from(seen.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [recoveryRows]);

  const filtered = useMemo(() => {
    let rows = recoveryRows;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.policyNumber.toLowerCase().includes(q) ||
          r.insuredTitle.toLowerCase().includes(q) ||
          r.reinsurerName.toLowerCase().includes(q) ||
          r.claimNumber.toLowerCase().includes(q),
      );
    }
    if (reinsurerFilter) {
      rows = rows.filter((r) => r.reinsurerId === reinsurerFilter);
    }
    return rows;
  }, [recoveryRows, search, reinsurerFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<RecoveryTableRow>[] = [
    {
      key: 'policyNumber',
      label: 'Policy Number',
      width: '150px',
      render: (row) => <EndorsedReferencePill id={row.placementId} reference={row.policyNumber} />,
    },
    {
      key: 'insuredTitle',
      label: 'Insured / Risk Type',
      width: 'minmax(150px, 1fr)',
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-gray-900 leading-tight">{row.insuredTitle}</span>
          <span className="text-xs text-gray-400">{row.riskType ?? '-'}</span>
        </div>
      ),
    },
    {
      key: 'reinsurerName',
      label: 'Reinsurer',
      width: 'minmax(130px, 0.7fr)',
      render: (row) => <span className="text-gray-700">{row.reinsurerName}</span>,
    },
    // {
    //   key: 'claimNumber',
    //   label: 'Claim Number',
    //   width: '140px',
    //   render: (row) => <span className="text-gray-700">{row.claimNumber}</span>,
    // },
    {
      key: 'cashCallNumber',
      label: 'Cash Call',
      width: '100px',
      className: 'text-center',
      render: (row) => (
        <span className="text-gray-600 block text-center">{row.cashCallNumber}</span>
      ),
    },
    {
      key: 'calledAmount',
      label: 'Called Amount',
      width: '120px',
      className: 'text-right',
      render: (row) => (
        <span className="font-medium text-gray-900 block">
          {fmtAmount(row.calledAmount, row.currency)}
        </span>
      ),
    },
    {
      key: 'recoveredAmount',
      label: 'Recovered',
      width: '120px',
      className: 'text-right',
      render: (row) => {
        if (row.confirmedAmount > 0.0001) {
          return (
            <span className="block font-bold text-green-600">
              {fmtAmount(row.confirmedAmount, row.currency)}
            </span>
          );
        }
        if (row.recordedAmount > 0.0001) {
          return (
            <span className="block font-medium text-amber-600">
              {fmtAmount(row.recordedAmount, row.currency)}
            </span>
          );
        }
        return <span className="block text-gray-700">{fmtAmount(0, row.currency)}</span>;
      },
    },
    {
      key: 'outstandingAmount',
      label: 'Outstanding',
      width: '120px',
      className: 'text-right',
      render: (row) => (
        <span
          className={`font-medium ${
            row.outstandingAmount > 0 ? 'text-orange-600' : 'text-gray-900'
          }`}
        >
          {fmtAmount(row.outstandingAmount, row.currency)}
        </span>
      ),
    },
    {
      key: 'recoveryStatus',
      label: 'Status',
      width: '100px',
      render: (row) => (
        <Badge
          label={RECOVERY_STATUS_LABEL[row.recoveryStatus]}
          variant={RECOVERY_STATUS_VARIANT[row.recoveryStatus]}
        />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '120px',
      render: (row) => {
        // A RECORDED (not yet bank-confirmed) receipt already covers what's left — recording
        // more would over-recover, so wait for that one to clear or get reversed.
        const fullyPending =
          row.outstandingAmount > 0.0001 && row.recordedAmount >= row.outstandingAmount - 0.0001;
        const canRecord =
          row.cashCallStatus === 'ISSUED' && row.outstandingAmount > 0.0001 && !fullyPending;
        return (
          <TableButton
            variant={canRecord ? 'blue' : 'gray'}
            disabled={!canRecord}
            tooltip={
              row.cashCallStatus !== 'ISSUED'
                ? 'Only issued cash calls can receive recovery receipts.'
                : row.outstandingAmount <= 0.0001
                  ? 'Fully recovered — see the claim History tab for receipts.'
                  : fullyPending
                    ? 'Already fully recorded — awaiting bank confirmation.'
                    : undefined
            }
            onClick={() => setPaymentRow(row)}
          >
            Record Recovery
          </TableButton>
        );
      },
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search recoveries..."
        searchValue={search}
        noInternalScroll
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        extraFilters={
          <div>
            <SearchSelect
              size="sm"
              placeholder="Reinsurers"
              options={reinsurerOptions}
              value={reinsurerFilter}
              onChange={(v) => {
                setReinsurerFilter(v);
                setPage(1);
              }}
            />
          </div>
        }
        emptyMessage="No recoveries found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <RecordRecoveryReceiptModal row={paymentRow} onClose={() => setPaymentRow(null)} />
    </>
  );
}
