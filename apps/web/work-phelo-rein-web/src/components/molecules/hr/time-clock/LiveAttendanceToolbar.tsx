import { RefreshCw, Search as SearchIcon } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { cn, cardClass, inputClass } from '@/lib/utils';

const STATUS_FILTER_OPTIONS = [
  { value: 'LATE', label: 'Late Arrivals' },
  { value: 'FLAGGED', label: 'Flagged' },
  { value: 'ON_BREAK', label: 'On Break' },
];

interface LiveAttendanceToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  deptFilter: string;
  onDeptFilterChange: (v: string) => void;
  departmentOptions: { value: string; label: string }[];
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  lastUpdated: string | null;
  onRefresh: () => void;
  isFetching: boolean;
}

export function LiveAttendanceToolbar({
  search,
  onSearchChange,
  deptFilter,
  onDeptFilterChange,
  departmentOptions,
  statusFilter,
  onStatusFilterChange,
  lastUpdated,
  onRefresh,
  isFetching,
}: LiveAttendanceToolbarProps) {
  return (
    <div className={cardClass('flex items-center gap-3 flex-wrap shrink-0 px-4 py-2')}>
      <div className="relative flex-1 min-w-52 max-w-sm">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search by employee name…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className={inputClass(undefined, 'pl-9 pr-4 py-2')}
        />
      </div>

      <div className="w-44">
        <SearchSelect
          placeholder="All Departments"
          size="sm"
          value={deptFilter}
          onChange={onDeptFilterChange}
          options={[{ value: '', label: 'All Departments' }, ...departmentOptions]}
        />
      </div>

      <div className="w-44">
        <SearchSelect
          placeholder="All Statuses"
          size="sm"
          value={statusFilter}
          onChange={onStatusFilterChange}
          options={[{ value: '', label: 'All Statuses' }, ...STATUS_FILTER_OPTIONS]}
        />
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <span className="relative flex w-2 h-2">
          <span className="absolute inline-flex w-full h-full rounded-full bg-green-400 opacity-75 animate-ping" />
          <span className="relative inline-flex w-2 h-2 rounded-full bg-green-500" />
        </span>
        <h3 className="text-sm font-semibold text-gray-900">Live Attendance</h3>
        {lastUpdated && <span className="text-xs text-gray-400">· updated at {lastUpdated}</span>}
      </div>
      <Button
        variant="outline"
        onClick={onRefresh}
        disabled={isFetching}
        className="gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
      >
        <RefreshCw className={cn('w-3 h-3', isFetching && 'animate-spin')} />
        Refresh
      </Button>
    </div>
  );
}
