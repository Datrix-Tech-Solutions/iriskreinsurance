import { SearchSelect } from '@/components/atoms/SearchSelect';

const PROJECT_STATUS_OPTIONS = [
  { value: 'PLANNING', label: 'Planning' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

interface ProjectFilterBarProps {
  statusFilter: string;
  onStatusChange: (v: string) => void;
  showClear: boolean;
  onClear: () => void;
}

export function ProjectFilterBar({
  statusFilter,
  onStatusChange,
  showClear,
  onClear,
}: ProjectFilterBarProps) {
  return (
    <>
      <div className="w-44">
        <SearchSelect
          placeholder="All Statuses"
          size="sm"
          value={statusFilter}
          onChange={onStatusChange}
          options={[{ value: '', label: 'All Statuses' }, ...PROJECT_STATUS_OPTIONS]}
        />
      </div>
      {showClear && (
        <button
          onClick={onClear}
          className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          Clear filters
        </button>
      )}
    </>
  );
}
