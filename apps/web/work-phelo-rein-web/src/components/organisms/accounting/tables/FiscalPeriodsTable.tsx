'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { TableButton } from '@/components/atoms/TableButton';
import { Badge } from '@/components/atoms/Badge';
import { AddFiscalPeriodPanel } from '@/components/organisms/accounting/panels/AddFiscalPeriodPanel';
import { FiscalPeriod, FiscalPeriodStatus } from '@/types/accounting';
import {
  useCloseFiscalPeriod,
  useFiscalPeriods,
  useLockFiscalPeriod,
  useOpenFiscalPeriod,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

const PAGE_SIZE = 10;

const STATUS_VARIANT: Record<FiscalPeriodStatus, 'success' | 'warning' | 'neutral'> = {
  OPEN: 'success',
  CLOSED: 'warning',
  LOCKED: 'neutral',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function buildColumns(
  onClose: (row: FiscalPeriod) => void,
  onReopen: (row: FiscalPeriod) => void,
  onLock: (row: FiscalPeriod) => void,
): Column<FiscalPeriod>[] {
  return [
    {
      key: 'name',
      label: 'Fiscal Year',
      width: 'minmax(150px, 1fr)',
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'startDate',
      label: 'Start Date',
      width: '180px',
      render: (row) => <span className="text-gray-700 text-sm">{fmtDate(row.startDate)}</span>,
    },
    {
      key: 'endDate',
      label: 'End Date',
      width: '180px',
      render: (row) => <span className="text-gray-700 text-sm">{fmtDate(row.endDate)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      width: '150px',
      render: (row) => <Badge label={row.status} variant={STATUS_VARIANT[row.status]} />,
    },
    {
      key: 'actions',
      label: '',
      width: '150px',
      render: (row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {row.status === 'OPEN' && (
            <TableButton variant="orange" onClick={() => onClose(row)}>
              Close
            </TableButton>
          )}
          {row.status === 'CLOSED' && (
            <>
              <TableButton variant="green" onClick={() => onReopen(row)}>
                Reopen
              </TableButton>
              <TableButton variant="red" onClick={() => onLock(row)}>
                Lock
              </TableButton>
            </>
          )}
        </div>
      ),
    },
  ];
}

export function FiscalPeriodsTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [lockTarget, setLockTarget] = useState<FiscalPeriod | null>(null);

  const { data = [], isLoading } = useFiscalPeriods();
  const closePeriod = useCloseFiscalPeriod();
  const reopenPeriod = useOpenFiscalPeriod();
  const lockPeriod = useLockFiscalPeriod();
  const toast = useToast();

  function close(period: FiscalPeriod) {
    closePeriod.mutate(period.id, {
      onError: (error) => toast.error(extractError(error, 'Failed to close fiscal year')),
    });
  }

  function reopen(period: FiscalPeriod) {
    reopenPeriod.mutate(period.id, {
      onError: (error) => toast.error(extractError(error, 'Failed to reopen fiscal year')),
    });
  }

  function lock(period: FiscalPeriod) {
    lockPeriod.mutate(period.id, {
      onSuccess: () => setLockTarget(null),
      onError: (error) => toast.error(extractError(error, 'Failed to lock fiscal year')),
    });
  }

  const columns = buildColumns(close, reopen, setLockTarget);

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter((r) => r.name.toLowerCase().includes(q));
  }, [search, data]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search fiscal years…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={{
          label: 'Add Fiscal Year',
          onClick: () => setPanelOpen(true),
        }}
        emptyMessage="No fiscal years found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <Modal
        isOpen={!!lockTarget}
        onClose={() => setLockTarget(null)}
        title="Lock Fiscal Year"
        description={`Are you sure you want to lock "${lockTarget?.name}"? Locked fiscal years are immutable and cannot be reopened.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setLockTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={lockPeriod.isPending}
              onClick={() => lockTarget && lock(lockTarget)}
            >
              Lock
            </Button>
          </div>
        }
      />

      <AddFiscalPeriodPanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  );
}
