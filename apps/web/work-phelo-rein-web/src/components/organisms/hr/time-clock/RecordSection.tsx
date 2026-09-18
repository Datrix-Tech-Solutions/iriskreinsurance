import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { Badge } from '@/components/atoms/Badge';
import { formatDate, formatTime, formatMinutes } from '@/lib/formatters';
import { Column, DataTable } from '../../shared/DataTable';
import type { TimeEntry } from '@/types/timeclock';

interface Props {
  recordsData: { data?: TimeEntry[]; totalPages?: number } | undefined;
  recordsLoading: boolean;
  recordsPage: number;
  onRecordsPageChange: (page: number) => void;
  filterFrom: string;
  filterTo: string;
  filterDept: string;
  filterStatus: string;
  recordsSearch: string;
  onFilterFromChange: (v: string) => void;
  onFilterToChange: (v: string) => void;
  onFilterDeptChange: (v: string) => void;
  onFilterStatusChange: (v: string) => void;
  onRecordsSearchChange: (v: string) => void;
  departments: { id: string; name: string }[];
}

export function RecordsSection({
  recordsData,
  recordsLoading,
  recordsPage,
  onRecordsPageChange,
  filterFrom,
  filterTo,
  filterDept,
  filterStatus,
  onFilterFromChange,
  onFilterToChange,
  onFilterDeptChange,
  onFilterStatusChange,
  onRecordsSearchChange,
  departments,
}: Props) {
  const recordsList = recordsData?.data ?? [];
  const recordsTotalPages = recordsData?.totalPages ?? 1;

  const recordsColumns: Column<TimeEntry>[] = [
    {
      key: 'employeeName',
      label: 'Employee',
      width: 'minmax(100px, 1fr)',
      render: (r) => <span className="font-medium">{r.employeeName}</span>,
    },
    {
      key: 'date',
      label: 'Date',
      width: '100px',
      render: (r) => <span>{formatDate(r.date)}</span>,
    },
    {
      key: 'department',
      label: 'Department',
      width: 'minmax(90px, 0.5fr)',
      render: (r) => <span>{r.department ?? '—'}</span>,
    },

    {
      key: 'clockIn',
      label: 'Clock In',
      width: '100px',
      render: (r) => <span>{formatTime(r.clockIn)}</span>,
    },
    {
      key: 'clockOut',
      label: 'Clock Out',
      width: '100px',
      render: (r) => <span>{r.clockOut ? formatTime(r.clockOut) : '—'}</span>,
    },
    {
      key: 'totalMinutes',
      label: 'Hours',
      width: '90px',
      render: (r) => <span className="font-semibold">{formatMinutes(r.totalMinutes)}</span>,
    },
    {
      key: 'location',
      label: 'Location',
      width: 'minmax(150px, 1.5fr)',
      render: (r) => <span className="block truncate">{r.location ?? '—'}</span>,
    },
    {
      key: 'flags',
      label: 'Flags',
      width: '100px',
      render: (r) =>
        r.isOutsideSchedule ? (
          <Badge variant="warning" label="Off Schedule" />
        ) : r.isLate ? (
          <Badge variant="warning" label="Late" />
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 shrink-0">
        <DatePicker placeholder="From date" value={filterFrom} onChange={onFilterFromChange} />
        <DatePicker placeholder="To date" value={filterTo} onChange={onFilterToChange} />
        <SearchSelect
          placeholder="All departments"
          options={[
            { value: '', label: 'All departments' },
            ...departments.map((d) => ({ value: d.id, label: d.name })),
          ]}
          value={filterDept}
          onChange={onFilterDeptChange}
        />
        <SearchSelect
          placeholder="All statuses"
          options={[
            { value: '', label: 'All statuses' },
            { value: 'CLOCKED_IN', label: 'Clocked In' },
            { value: 'CLOCKED_OUT', label: 'Clocked Out' },
          ]}
          value={filterStatus}
          onChange={onFilterStatusChange}
        />
      </div>

      <DataTable
        columns={recordsColumns}
        data={recordsList}
        isLoading={recordsLoading}
        searchPlaceholder="Search by employee name…"
        onSearch={onRecordsSearchChange}
        currentPage={recordsPage}
        totalPages={recordsTotalPages}
        onPageChange={onRecordsPageChange}
        noInternalScroll
        onExport={() => {
          // CSV export logic can be added here
          console.log('Exporting records...');
        }}
      />
    </div>
  );
}
