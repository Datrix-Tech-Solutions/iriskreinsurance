import { SearchIcon } from 'lucide-react';
import { cardClass, inputClass } from '@/lib/utils';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { WeekSelector } from './WeekSelector';

interface Props {
  search: string;
  onSearchChange: (value: string) => void;
  departmentId: string;
  onDepartmentChange: (id: string) => void;
  departments: { id: string; name: string }[];
  weekStart: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
}

export function SchedulingToolbar({
  search,
  onSearchChange,
  departmentId,
  onDepartmentChange,
  departments,
  weekStart,
  onPrevWeek,
  onNextWeek,
}: Props) {
  return (
    <div className={cardClass('flex items-center flex-wrap shrink-0 mb-6 gap-3 px-4 py-2')}>
      {/* Search */}
      <div className="relative flex-1 min-w-52 max-w-sm">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search employee..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className={inputClass(undefined, 'pl-9 pr-4 py-2')}
        />
      </div>

      {/* Department filter */}
      <div className="w-44 shrink-0">
        <SearchSelect
          placeholder="All Departments"
          size="sm"
          options={[
            { value: '', label: 'All Departments' },
            ...departments.map((d) => ({ value: d.id, label: d.name })),
          ]}
          value={departmentId}
          onChange={onDepartmentChange}
        />
      </div>

      <div className="flex-1" />

      <WeekSelector weekStart={weekStart} onPrev={onPrevWeek} onNext={onNextWeek} endOffset={6} />
    </div>
  );
}
