'use client';

import { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { Avatar } from '@/components/atoms/Avatar';
import { formatTime } from '@/lib/formatters';
import { Column, DataTable } from '@/components/organisms/shared/DataTable';
import { LiveAttendanceStatsRow } from '@/components/molecules/hr/time-clock/LiveAttendanceStatsRow';
import { LiveAttendanceToolbar } from '@/components/molecules/hr/time-clock/LiveAttendanceToolbar';
import { useLiveAttendance, useAttendanceStats } from '@/hooks/hr/useTimeClock';
import type { LiveAttendanceEntry } from '@/types/timeclock';

function formatDurationMs(ms: number) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m`;
}

function formatWorkMode(workMode?: LiveAttendanceEntry['workMode']) {
  if (!workMode) return null;
  return workMode.charAt(0) + workMode.slice(1).toLowerCase();
}

function statusBadge(entry: LiveAttendanceEntry) {
  if (entry.status === 'ON_BREAK') return <Badge variant="info" label="On Break" />;
  if (entry.isOutsideSchedule) return <Badge variant="warning" label="Off Schedule" />;
  if (entry.isLate) return <Badge variant="warning" label="Late" />;
  return <Badge variant="success" label="On Time" />;
}

function matchesStatusFilter(entry: LiveAttendanceEntry, statusFilter: string): boolean {
  switch (statusFilter) {
    case 'LATE':
      return entry.isLate;
    case 'FLAGGED':
      return !!entry.isOutsideSchedule;
    case 'ON_BREAK':
      return entry.status === 'ON_BREAK';
    default:
      return true;
  }
}

export function LiveAttendanceTable() {
  // Snapshot of current time, updated every 60 s to refresh durations
  const [now, setNow] = useState(() => Date.now());
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: entries = [], isLoading, dataUpdatedAt, refetch, isFetching } = useLiveAttendance();

  const { data: stats } = useAttendanceStats();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : null;

  const departmentOptions = useMemo(() => {
    const names = Array.from(
      new Set(entries.map((e) => e.department).filter((d): d is string => !!d)),
    ).sort();
    return names.map((name) => ({ value: name, label: name }));
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (deptFilter && e.department !== deptFilter) return false;
      if (statusFilter && !matchesStatusFilter(e, statusFilter)) return false;
      if (search && !e.employeeName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [entries, deptFilter, statusFilter, search]);

  const columns: Column<LiveAttendanceEntry>[] = [
    {
      key: 'employeeName',
      label: 'Employee',
      width: 'minmax(150px, 1.5fr)',
      render: (entry) => {
        const workModeLabel = formatWorkMode(entry.workMode);
        return (
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={entry.employeeName} avatarUrl={entry.avatarUrl} size="sm" />
            <div className="min-w-0">
              <p className="font-medium text-gray-900 truncate">{entry.employeeName}</p>
              {(entry.jobTitle || workModeLabel) && (
                <p className="text-xs text-gray-400 truncate">
                  {entry.jobTitle ?? 'Shift'}
                  {workModeLabel ? ` · ${workModeLabel}` : ''}
                </p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: 'department',
      label: 'Department',
      width: 'minmax(100px,0.9fr)',
      render: (entry) => <span className="text-gray-600 truncate">{entry.department ?? '—'}</span>,
    },
    {
      key: 'clockIn',
      label: 'Clock In',
      width: '100px',
      render: (entry) => (
        <span className="tabular-nums text-gray-700">{formatTime(entry.clockIn)}</span>
      ),
    },
    {
      key: 'duration',
      label: 'Duration',
      width: '100px',
      render: (entry) => (
        <span className="tabular-nums font-medium text-gray-900">
          {formatDurationMs(now - new Date(entry.clockIn).getTime())}
        </span>
      ),
    },
    {
      key: 'location',
      label: 'Location',
      width: 'minmax(150px, 1.5fr)',
      render: (entry) => (
        <span className="text-gray-600 block truncate">{entry.location ?? '—'}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '110px',
      render: (entry) => statusBadge(entry),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <LiveAttendanceStatsRow stats={stats} />

      <LiveAttendanceToolbar
        search={search}
        onSearchChange={setSearch}
        deptFilter={deptFilter}
        onDeptFilterChange={setDeptFilter}
        departmentOptions={departmentOptions}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        lastUpdated={lastUpdated}
        onRefresh={() => refetch()}
        isFetching={isFetching}
      />

      <DataTable
        columns={columns}
        data={filteredEntries}
        isLoading={isLoading}
        emptyMessage="No employees clocked in right now"
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        noInternalScroll
      />
    </div>
  );
}
