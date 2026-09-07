import { SearchSelect } from '@/components/atoms/SearchSelect';

interface EmployeeFilterBarProps {
  statusFilter: string;
  onStatusChange: (v: string) => void;
  deptFilter: string;
  onDeptChange: (v: string) => void;
  typeFilter: string;
  onTypeChange: (v: string) => void;
  departments: { id: string; name: string }[];
  canViewRestricted: boolean;
  showClear: boolean;
  onClear: () => void;
}

export function EmployeeFilterBar({
  statusFilter,
  onStatusChange,
  deptFilter,
  onDeptChange,
  typeFilter,
  onTypeChange,
  departments,
  canViewRestricted,
  showClear,
  onClear,
}: EmployeeFilterBarProps) {
  return (
    <>
      <div className="w-44">
        <SearchSelect
          placeholder="All Statuses"
          size="sm"
          value={statusFilter}
          onChange={onStatusChange}
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'ACTIVE', label: 'Permanent Staff' },
            { value: 'PROBATION', label: 'Probation' },
            ...(canViewRestricted
              ? [
                  { value: 'SUSPENDED', label: 'Suspended' },
                  { value: 'OFFBOARDED', label: 'Offboarded' },
                ]
              : []),
          ]}
        />
      </div>
      <div className="w-44">
        <SearchSelect
          placeholder="All Departments"
          size="sm"
          value={deptFilter}
          onChange={onDeptChange}
          options={[
            { value: '', label: 'All Departments' },
            ...departments.map((d) => ({ value: d.id, label: d.name })),
          ]}
        />
      </div>
      <div className="w-44">
        <SearchSelect
          placeholder="All Types"
          size="sm"
          value={typeFilter}
          onChange={onTypeChange}
          options={[
            { value: '', label: 'All Types' },
            { value: 'FULL_TIME', label: 'Full Time' },
            { value: 'PART_TIME', label: 'Part Time' },
            { value: 'CONTRACT', label: 'Contract' },
            { value: 'INTERN', label: 'Intern' },
          ]}
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
