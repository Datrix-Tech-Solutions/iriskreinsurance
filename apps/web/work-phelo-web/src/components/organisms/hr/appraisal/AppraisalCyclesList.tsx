'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQueries } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Button } from '@/components/atoms/Button';
import { TableButton } from '@/components/atoms/TableButton';
import { Modal } from '@/components/organisms/shared/Modal';
import { CreateCyclePanel } from '@/components/organisms/hr/appraisal/CreateCyclePanel';
import {
  useAppraisalCycles,
  useDeleteAppraisalCycle,
  useStartAppraisalCycle,
  useSeedCycleFromTemplate,
  useCancelAppraisalCycle,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { formatDate } from '@/lib/formatters';
import { api } from '@/lib/api';
import { AppraisalCycle } from '@/types/hr';
import { cn } from '@/lib/utils';

interface Props {
  tenantSlug: string;
}

type DerivedStatus = 'Upcoming' | 'In Progress' | 'Completed' | 'Expired' | 'Cancelled';

const STATUS_STYLES: Record<DerivedStatus, { dot: string; text: string }> = {
  'In Progress': { dot: 'bg-blue-500', text: 'text-blue-600' },
  Completed: { dot: 'bg-green-500', text: 'text-green-600' },
  Upcoming: { dot: 'bg-gray-400', text: 'text-gray-500' },
  Expired: { dot: 'bg-red-400', text: 'text-red-500' },
  Cancelled: { dot: 'bg-red-300', text: 'text-red-400' },
};

/**
 * Batches per-cycle appraisal-completion queries so derived status can be computed for every
 * row up front (rowActions/column renderers run outside component context, so hooks can't be
 * called per-row there). Shares the cache with useCycleAppraisals via a matching query key.
 */
function useDerivedCycleStatuses(cycles: AppraisalCycle[]): Map<string, DerivedStatus> {
  const queries = useQueries({
    queries: cycles.map((c) => ({
      queryKey: ['cycle-appraisals', c.id],
      queryFn: () => api.get(`/hr/appraisals/cycles/${c.id}/appraisals`).then((r) => r.data),
      enabled: !!c.id,
    })),
  });

  return useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const map = new Map<string, DerivedStatus>();

    cycles.forEach((cycle, i) => {
      const raw = queries[i]?.data;
      const appraisals: { selfStatus?: string; managerStatus?: string }[] = Array.isArray(raw)
        ? raw
        : raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).data)
          ? (raw as { data: { selfStatus?: string; managerStatus?: string }[] }).data
          : [];

      const total = appraisals.length;
      const selfCompleted = appraisals.filter((a) => a.selfStatus === 'SUBMITTED').length;
      const managerCompleted = appraisals.filter((a) => a.managerStatus === 'SUBMITTED').length;
      const rate =
        total > 0 ? Math.round(((selfCompleted + managerCompleted) / (total * 2)) * 100) : 0;

      let status: DerivedStatus;
      if (cycle.status === 'CANCELLED') status = 'Cancelled';
      else if (rate >= 100) status = 'Completed';
      else if (cycle.endDate < today) status = 'Expired';
      else if (cycle.status === 'UPCOMING') status = 'Upcoming';
      else status = 'In Progress';

      map.set(cycle.id, status);
    });

    return map;
  }, [cycles, queries]);
}

function CycleStatusBadge({ status }: { status: DerivedStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', s.text)}>
      <span className={cn('w-2 h-2 rounded-full shrink-0', s.dot)} />
      {status}
    </span>
  );
}

export function AppraisalCyclesList({ tenantSlug }: Props) {
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editCycle, setEditCycle] = useState<AppraisalCycle | undefined>();
  const [forceCreate, setForceCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AppraisalCycle | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AppraisalCycle | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [startTarget, setStartTarget] = useState<AppraisalCycle | null>(null);

  const PAGE_SIZE = 10;
  const { data, isLoading } = useAppraisalCycles({ page, search: search || undefined });
  const allCycles: AppraisalCycle[] = data ?? [];
  const totalPages = Math.max(1, Math.ceil(allCycles.length / PAGE_SIZE));
  const cycles = allCycles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const statusMap = useDerivedCycleStatuses(cycles);

  const { mutate: startCycle, isPending: isStarting } = useStartAppraisalCycle();
  const { mutate: seedKpis, isPending: isSeeding } = useSeedCycleFromTemplate();
  const { mutate: deleteCycle, isPending: isDeleting } = useDeleteAppraisalCycle();
  const { mutate: cancelCycle, isPending: isCancelling } = useCancelAppraisalCycle();

  const handleStart = (cycle: AppraisalCycle) => {
    const doStart = () =>
      startCycle(cycle.id, {
        onSuccess: () => {
          toast.success('Cycle started');
          setStartTarget(null);
        },
        onError: (err) => toast.error(extractError(err, 'Failed to start cycle')),
      });

    if (cycle.templateId) {
      seedKpis(cycle.id, {
        onSuccess: doStart,
        onError: (err) => toast.error(extractError(err, 'Failed to seed KPIs from template')),
      });
    } else {
      doStart();
    }
  };

  const columns: Column<AppraisalCycle>[] = [
    {
      key: 'title',
      label: 'Cycle Name',
      width: 'minmax(200px, 1fr)',
      render: (row) => (
        <Link
          href={`/${tenantSlug}/hr/hrmanagement/appraisal/cycles/${row.id}`}
          className="font-medium text-gray-900 hover:text-brand hover:underline transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {row.title}
        </Link>
      ),
    },
    {
      key: 'startDate',
      label: 'Start Date',
      width: '150px',
      render: (row) => <span className="text-gray-700">{formatDate(row.startDate)}</span>,
    },
    {
      key: 'endDate',
      label: 'End Date',
      width: '150px',
      render: (row) => <span className="text-gray-700">{formatDate(row.endDate)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      width: '140px',
      render: (row) => <CycleStatusBadge status={statusMap.get(row.id) ?? 'Upcoming'} />,
    },
    {
      key: 'actions',
      label: '',
      width: '220px',
      render: (row) => {
        const status = statusMap.get(row.id) ?? 'Upcoming';
        const edit = () => {
          setForceCreate(false);
          setEditCycle(row);
          setPanelOpen(true);
        };

        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {status === 'Upcoming' && (
              <>
                <TableButton variant="green" onClick={() => setStartTarget(row)}>
                  Start
                </TableButton>
                <TableButton variant="gray" onClick={edit}>
                  Edit
                </TableButton>
                <TableButton variant="red" onClick={() => setDeleteTarget(row)}>
                  Delete
                </TableButton>
              </>
            )}

            {status === 'In Progress' && (
              <>
                <TableButton variant="gray" onClick={edit}>
                  Edit
                </TableButton>
                <TableButton variant="red" onClick={() => setCancelTarget(row)}>
                  Cancel Cycle
                </TableButton>
              </>
            )}

            {status === 'Expired' && (
              <>
                <TableButton variant="gray" onClick={edit}>
                  Edit
                </TableButton>
                <TableButton variant="red" onClick={() => setDeleteTarget(row)}>
                  Delete
                </TableButton>
              </>
            )}

            {status === 'Cancelled' && (
              <TableButton
                variant="blue"
                onClick={() => {
                  setForceCreate(true);
                  setEditCycle(row);
                  setPanelOpen(true);
                }}
              >
                Reuse
              </TableButton>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col">
      <DataTable
        columns={columns}
        data={cycles}
        isLoading={isLoading}
        emptyMessage="No appraisal cycles yet — create your first one"
        searchPlaceholder="Search cycles..."
        onSearch={setSearch}
        actionButton={{
          label: 'New Cycle',
          onClick: () => {
            setEditCycle(undefined);
            setPanelOpen(true);
          },
        }}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <CreateCyclePanel
        isOpen={panelOpen}
        onClose={() => {
          setPanelOpen(false);
          setEditCycle(undefined);
          setForceCreate(false);
        }}
        editCycle={editCycle}
        forceCreate={forceCreate}
      />

      {/* Delete modal — Upcoming / Expired only */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Cycle"
        description={`Are you sure you want to delete "${deleteTarget?.title}"? This cannot be undone.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isDeleting}
              loadingText="Deleting..."
              onClick={() =>
                deleteTarget &&
                deleteCycle(deleteTarget.id, {
                  onSuccess: () => {
                    toast.success('Cycle deleted');
                    setDeleteTarget(null);
                  },
                  onError: (err) => toast.error(extractError(err, 'Failed to delete cycle')),
                })
              }
            >
              Delete
            </Button>
          </>
        }
      />

      {/* Cancel modal — In Progress */}
      <Modal
        isOpen={!!cancelTarget}
        onClose={() => {
          setCancelTarget(null);
          setCancelReason('');
        }}
        title="Cancel Cycle"
        description={`Are you sure you want to cancel "${cancelTarget?.title}"? All in-progress appraisals will be stopped.`}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setCancelTarget(null);
                setCancelReason('');
              }}
            >
              Back
            </Button>
            <Button
              variant="danger"
              isLoading={isCancelling}
              loadingText="Cancelling..."
              disabled={!cancelReason.trim()}
              onClick={() =>
                cancelTarget &&
                cancelCycle(
                  { id: cancelTarget.id, reason: cancelReason.trim() },
                  {
                    onSuccess: () => {
                      toast.success('Cycle cancelled');
                      setCancelTarget(null);
                      setCancelReason('');
                    },
                    onError: (err) => toast.error(extractError(err, 'Failed to cancel cycle')),
                  },
                )
              }
            >
              Cancel Cycle
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-medium text-gray-700">Reason for cancellation</label>
          <textarea
            rows={3}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Enter reason…"
            className="w-full rounded-input border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
          />
        </div>
      </Modal>

      {/* Start modal */}
      <Modal
        isOpen={!!startTarget}
        onClose={() => setStartTarget(null)}
        title="Start Appraisal Cycle"
        description={`Start "${startTarget?.title}"? This will generate appraisal records for all employees.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setStartTarget(null)}>
              Cancel
            </Button>
            <Button
              isLoading={isSeeding || isStarting}
              loadingText={isSeeding ? 'Seeding KPIs...' : 'Starting...'}
              onClick={() => startTarget && handleStart(startTarget)}
            >
              Start Cycle
            </Button>
          </div>
        }
      />
    </div>
  );
}
