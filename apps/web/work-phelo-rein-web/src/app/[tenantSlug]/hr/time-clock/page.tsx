'use client';

import { use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { pageHeader, pagePx, pageContent } from '@/lib/layout';
import { useDepartmentOptions } from '@/hooks/hr/useDepartments';

import { CorrectionRequestPanel } from '@/components/organisms/hr/time-clock/CorrectionRequestPanel';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';

import {
  useMyTodaySession,
  useClockIn,
  useClockOut,
  useMyAttendanceHistory,
  useAttendanceRecords,
  useCorrectionRequests,
  useReviewCorrectionRequest,
} from '@/hooks/hr/useTimeClock';
import { TimeClockTabs } from '@/components/molecules/hr/time-clock/TimeClockTabs';
import { MyTimeSection } from '@/components/organisms/hr/time-clock/MyTimeSection';
import { LiveAttendanceTable } from '@/components/organisms/hr/time-clock/LiveAttendanceTable';
import { RecordsSection } from '@/components/organisms/hr/time-clock/RecordSection';
import { CorrectionsSection } from '@/components/organisms/hr/time-clock/CorrectionSection';

const VALID_TABS = ['my', 'live', 'records', 'corrections'] as const;
type TimeClockTab = (typeof VALID_TABS)[number];

export default function TimeClockPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (user !== null && !user.featureConfig?.hr?.timeclock) {
      router.replace(`/${tenantSlug}/hr`);
    }
  }, [user, tenantSlug, router]);
  const toast = useToast();

  const isAdmin = user?.role === 'TENANT_ADMIN';
  const canManageTime = usePermission(Permission.APPROVE_TIME_CORRECTION);
  const canViewAttendance = usePermission(Permission.READ_ATTENDANCE);
  const canManageRecords = canViewAttendance || isAdmin;
  const canApproveCorrections = canManageTime || isAdmin;

  const [activeTab, setActiveTab] = useState<TimeClockTab>(() => {
    const tabParam = searchParams.get('tab') as TimeClockTab | null;
    if (tabParam && VALID_TABS.includes(tabParam)) return tabParam;
    return useAuthStore.getState().user?.role === 'TENANT_ADMIN' ? 'live' : 'my';
  });
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{
    req: { id: string; employeeName?: string; date: string };
    action: 'APPROVED' | 'REJECTED';
  } | null>(null);

  // My Time hooks
  const { data: session, isLoading: sessionLoading } = useMyTodaySession();
  const { mutate: clockIn, isPending: isClockingIn } = useClockIn();
  const { mutate: clockOut, isPending: isClockingOut } = useClockOut();

  // History
  const [historyPage, setHistoryPage] = useState(1);
  const { data: historyData, isLoading: historyLoading } = useMyAttendanceHistory(historyPage);

  // Records (Admin)
  const [recordsPage, setRecordsPage] = useState(1);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [recordsSearch, setRecordsSearch] = useState('');

  const { data: recordsData, isLoading: recordsLoading } = useAttendanceRecords({
    page: recordsPage,
    fromDate: filterFrom,
    toDate: filterTo,
    departmentId: filterDept,
    status: filterStatus,
    search: recordsSearch,
  });

  const { data: departmentsRaw } = useDepartmentOptions();
  const departments = Array.isArray(departmentsRaw) ? departmentsRaw : [];

  // Corrections
  const [correctionStatusFilter, setCorrectionStatusFilter] = useState<
    'PENDING' | 'APPROVED' | 'REJECTED'
  >('PENDING');
  const { data: corrections = [], isLoading: correctionsLoading } =
    useCorrectionRequests(correctionStatusFilter);

  const { data: pendingCorrections = [] } = useCorrectionRequests('PENDING');
  const pendingCount = canApproveCorrections ? pendingCorrections.length : 0;

  const { mutate: reviewCorrection, isPending: isReviewing } = useReviewCorrectionRequest();

  const handleReview = () => {
    if (!reviewTarget) return;
    reviewCorrection(
      { id: reviewTarget.req.id, action: reviewTarget.action },
      {
        onSuccess: () => {
          toast.success(
            reviewTarget.action === 'APPROVED' ? 'Correction approved' : 'Correction rejected',
          );
          setReviewTarget(null);
        },
        onError: (err) => toast.error(extractError(err, 'Failed to review correction')),
      },
    );
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0">
        <div className={pageHeader}>
          <h1 className="text-xl font-bold text-gray-900">Time Management</h1>
        </div>
        <TimeClockTabs
          activeTab={activeTab}
          canManageRecords={canManageRecords}
          canApproveCorrections={canApproveCorrections}
          isEmployee={!isAdmin}
          pendingCount={pendingCount}
          onTabChange={setActiveTab}
          className={pagePx}
        />
      </div>

      <div className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto flex flex-col')}>
        {activeTab === 'my' && !isAdmin && (
          <MyTimeSection
            session={session}
            isLoading={sessionLoading}
            onClockIn={(location) =>
              clockIn(location ? { location } : undefined, {
                onSuccess: () => toast.success('Clocked in successfully'),
                onError: (err) => toast.error(extractError(err, 'Failed to clock in')),
              })
            }
            onClockOut={() =>
              clockOut(undefined, {
                onSuccess: () => toast.success('Clocked out successfully'),
                onError: (err) => toast.error(extractError(err, 'Failed to clock out')),
              })
            }
            onReportMissed={() => setCorrectionOpen(true)}
            isClockingIn={isClockingIn}
            isClockingOut={isClockingOut}
            historyData={historyData}
            historyLoading={historyLoading}
            historyPage={historyPage}
            onHistoryPageChange={setHistoryPage}
          />
        )}

        {activeTab === 'live' && canManageRecords && <LiveAttendanceTable />}

        {activeTab === 'records' && canManageRecords && (
          <RecordsSection
            recordsData={recordsData}
            recordsLoading={recordsLoading}
            recordsPage={recordsPage}
            onRecordsPageChange={setRecordsPage}
            filterFrom={filterFrom}
            filterTo={filterTo}
            filterDept={filterDept}
            filterStatus={filterStatus}
            recordsSearch={recordsSearch}
            onFilterFromChange={setFilterFrom}
            onFilterToChange={setFilterTo}
            onFilterDeptChange={setFilterDept}
            onFilterStatusChange={setFilterStatus}
            onRecordsSearchChange={setRecordsSearch}
            departments={departments}
          />
        )}

        {activeTab === 'corrections' && canApproveCorrections && (
          <CorrectionsSection
            corrections={corrections}
            correctionsLoading={correctionsLoading}
            correctionStatusFilter={correctionStatusFilter}
            onStatusFilterChange={setCorrectionStatusFilter}
            pendingCount={pendingCount}
            onReview={(req, action) => setReviewTarget({ req, action })}
          />
        )}
      </div>

      {/* Global Panels */}
      <CorrectionRequestPanel isOpen={correctionOpen} onClose={() => setCorrectionOpen(false)} />

      <Modal
        isOpen={!!reviewTarget}
        onClose={() => setReviewTarget(null)}
        title={reviewTarget?.action === 'APPROVED' ? 'Approve Correction' : 'Reject Correction'}
        description={
          reviewTarget
            ? `${reviewTarget.action === 'APPROVED' ? 'Approve' : 'Reject'} the correction request from ${reviewTarget.req.employeeName ?? 'this employee'} for ${formatDate(reviewTarget.req.date)}?`
            : ''
        }
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setReviewTarget(null)}>
              Cancel
            </Button>
            <Button
              variant={reviewTarget?.action === 'APPROVED' ? 'primary' : 'danger'}
              isLoading={isReviewing}
              onClick={handleReview}
            >
              {reviewTarget?.action === 'APPROVED' ? 'Approve' : 'Reject'}
            </Button>
          </div>
        }
      />
    </div>
  );
}
