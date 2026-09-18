'use client';

import { useState, useMemo } from 'react';
import { CalendarDays, Clock, CheckCircle2, XCircle, Ban } from 'lucide-react';
import { extractError } from '@/lib/extractError';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { ApplyLeavePanel } from '@/components/organisms/hr/leave/ApplyLeavePanel';
import { useLeaveBalances, useMyLeaveRequests, useCancelLeaveRequest } from '@/hooks/hr/useLeave';
import { useToast } from '@/hooks/useToast';
import { formatDate } from '@/lib/formatters';
import { LeaveBalance, LeaveRequest, LeaveRequestStatus } from '@/types/hr';

const STATUS_VARIANT: Record<LeaveRequestStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  APPROVED: 'success',
  PENDING: 'warning',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
};

const STATUS_ICON: Record<LeaveRequestStatus, React.ReactNode> = {
  APPROVED: <CheckCircle2 className="w-5 h-5 text-green-500" />,
  PENDING: <Clock className="w-5 h-5 text-yellow-500" />,
  REJECTED: <XCircle className="w-5 h-5 text-red-500" />,
  CANCELLED: <Ban className="w-5 h-5 text-gray-400" />,
};

const PAGE_SIZE = 10;

interface Props {
  tenantSlug: string;
}

export function MyLeaveTab({ tenantSlug }: Props) {
  const toast = useToast();

  const [applyOpen, setApplyOpen] = useState(false);
  const [detailRequest, setDetailRequest] = useState<LeaveRequest | null>(null);
  const [cancelTarget, setCancelTarget] = useState<LeaveRequest | null>(null);
  const [mySearch, setMySearch] = useState('');
  const [myPage, setMyPage] = useState(1);

  const { data: balancesRaw } = useLeaveBalances();
  const balancesData: LeaveBalance[] = Array.isArray(balancesRaw)
    ? balancesRaw
    : ((balancesRaw as { data?: LeaveBalance[] } | undefined)?.data ?? []);

  const { data: myData, isLoading: myLoading } = useMyLeaveRequests();

  const myRequests: LeaveRequest[] = useMemo(() => {
    return Array.isArray(myData)
      ? myData
      : ((myData as { data?: LeaveRequest[] } | undefined)?.data ?? []);
  }, [myData]);

  const myFiltered = useMemo(() => {
    if (!mySearch) return myRequests;
    const q = mySearch.toLowerCase();
    return myRequests.filter((r) => r.leaveTypeName.toLowerCase().includes(q));
  }, [myRequests, mySearch]);

  const myPageData = myFiltered.slice((myPage - 1) * PAGE_SIZE, myPage * PAGE_SIZE);
  const myTotalPages = Math.max(1, Math.ceil(myFiltered.length / PAGE_SIZE));

  const { mutate: cancelRequest, isPending: isCancelling } = useCancelLeaveRequest();

  /* Balance for the currently open detail request */
  const detailBalance = detailRequest
    ? (balancesData.find((b) => b.leaveTypeId === detailRequest.leaveTypeId) ?? null)
    : null;

  const columns: Column<LeaveRequest>[] = [
    {
      key: 'leaveTypeName',
      label: 'Leave Type',
      width: 'minmax(200px, 1.5fr)',
      render: (r) => <span className="font-medium text-gray-900">{r.leaveTypeName}</span>,
    },
    {
      key: 'period',
      label: 'Period',
      width: 'minmax(150px, 1fr)',
      render: (r) => (
        <span className="text-sm text-gray-500">
          {formatDate(r.startDate)} – {formatDate(r.endDate)}
        </span>
      ),
    },
    {
      key: 'totalDays',
      label: 'Days',
      width: '100px',
      render: (r) => <span className="text-gray-700">{r.totalDays}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      width: '150px',
      render: (r) => <Badge variant={STATUS_VARIANT[r.status]} label={r.status} />,
    },
  ];

  const handleCancelConfirm = () => {
    if (!cancelTarget) return;
    cancelRequest(cancelTarget.id, {
      onSuccess: () => {
        toast.success('Leave request cancelled');
        setCancelTarget(null);
        setDetailRequest(null);
      },
      onError: (err) => toast.error(extractError(err, 'Something went wrong')),
    });
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <DataTable
          columns={columns}
          data={myPageData}
          isLoading={myLoading}
          emptyMessage="You have no leave requests yet"
          searchPlaceholder="Search by leave type..."
          searchValue={mySearch}
          onSearch={(q) => {
            setMySearch(q);
            setMyPage(1);
          }}
          actionButton={{ label: 'Apply for Leave', onClick: () => setApplyOpen(true) }}
          currentPage={myPage}
          totalPages={myTotalPages}
          onPageChange={setMyPage}
          onRowClick={(row) => setDetailRequest(row)}
          noInternalScroll
        />
      </div>

      {/* ── Apply leave panel ── */}
      <ApplyLeavePanel
        isOpen={applyOpen}
        onClose={() => setApplyOpen(false)}
        tenantSlug={tenantSlug}
        balances={balancesData}
      />

      {/* ── Leave detail side panel ── */}
      <SidePanel
        isOpen={!!detailRequest}
        onClose={() => setDetailRequest(null)}
        title={detailRequest?.leaveTypeName ?? ''}
        description="Leave request details"
        footer={
          detailRequest?.status === 'PENDING' ? (
            <Button
              variant="danger"
              className="w-full"
              onClick={() => setCancelTarget(detailRequest)}
            >
              Cancel Request
            </Button>
          ) : undefined
        }
      >
        {detailRequest && (
          <div className="flex flex-col gap-6">
            {/* Status */}
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-gray-50 border border-gray-100">
              {STATUS_ICON[detailRequest.status]}
              <div>
                <p className="text-sm font-semibold text-gray-900">{detailRequest.status}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {detailRequest.status === 'APPROVED' && 'Your leave has been approved'}
                  {detailRequest.status === 'PENDING' && 'Awaiting approval from your manager'}
                  {detailRequest.status === 'REJECTED' && 'Your leave request was not approved'}
                  {detailRequest.status === 'CANCELLED' && 'This request was cancelled'}
                </p>
              </div>
            </div>

            {/* Dates */}
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Period</p>
              <div className="flex items-center gap-3">
                <CalendarDays className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-sm text-gray-900">
                  {formatDate(detailRequest.startDate)} – {formatDate(detailRequest.endDate)}
                </span>
              </div>
              <p className="text-sm text-gray-500 pl-7">
                <span className="font-semibold text-gray-900">{detailRequest.totalDays}</span>{' '}
                working day{detailRequest.totalDays !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Type */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-900">{detailRequest.leaveTypeName}</span>
                <Badge
                  variant={detailRequest.isPaid ? 'success' : 'neutral'}
                  label={detailRequest.isPaid ? 'Paid' : 'Unpaid'}
                />
              </div>
            </div>

            {/* Reason */}
            {detailRequest.reason && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Reason
                </p>
                <p className="text-sm text-gray-700 leading-relaxed">{detailRequest.reason}</p>
              </div>
            )}

            {/* Review note */}
            {detailRequest.reviewNote && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Manager Note
                </p>
                <p className="text-sm text-gray-700 leading-relaxed">{detailRequest.reviewNote}</p>
              </div>
            )}

            {/* Balance */}
            {detailBalance && (
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Balance
                </p>
                <div className="rounded-2xl border border-gray-200 bg-white p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{detailBalance.leaveTypeName}</span>
                    <span>{detailBalance.entitled} days/yr</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand rounded-full transition-all"
                      style={{
                        width: `${detailBalance.entitled > 0 ? Math.min(100, (detailBalance.used / detailBalance.entitled) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">
                      <span className="font-semibold text-gray-900">{detailBalance.remaining}</span>{' '}
                      remaining
                    </span>
                    <span className="text-gray-400">{detailBalance.used} used</span>
                  </div>
                  {detailBalance.pending > 0 && (
                    <p className="text-xs text-orange-500">
                      {detailBalance.pending} day{detailBalance.pending !== 1 ? 's' : ''} pending
                      approval
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </SidePanel>

      {/* ── Cancel confirmation modal ── */}
      <Modal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Cancel Leave Request"
        description={`Cancel your ${cancelTarget?.leaveTypeName} request from ${cancelTarget ? formatDate(cancelTarget.startDate) : ''} to ${cancelTarget ? formatDate(cancelTarget.endDate) : ''}? This cannot be undone.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setCancelTarget(null)}>
              Keep Request
            </Button>
            <Button
              variant="danger"
              isLoading={isCancelling}
              loadingText="Cancelling..."
              onClick={handleCancelConfirm}
            >
              Cancel Request
            </Button>
          </div>
        }
      />
    </>
  );
}
