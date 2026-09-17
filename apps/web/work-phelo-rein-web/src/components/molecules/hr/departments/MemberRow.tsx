import { cn } from '@/lib/utils';
import { Avatar } from '@/components/atoms/Avatar';
import { EmployeeOption } from '@/types/hr';

interface MemberRowProps {
  employee: EmployeeOption;
  checked: boolean;
  alreadyInDept: boolean;
  onToggle: (id: string) => void;
}

export function MemberRow({ employee: emp, checked, alreadyInDept, onToggle }: MemberRowProps) {
  return (
    <label
      className={cn(
        'flex items-center gap-3 py-3 cursor-pointer hover:bg-gray-50 -mx-6 px-6 transition-colors',
        alreadyInDept && 'opacity-50 cursor-not-allowed',
      )}
    >
      <input
        type="checkbox"
        checked={checked || alreadyInDept}
        disabled={alreadyInDept}
        onChange={() => !alreadyInDept && onToggle(emp.id)}
        className="w-4 h-4 rounded accent-brand shrink-0"
      />
      <Avatar name={`${emp.firstName} ${emp.lastName}`} avatarUrl={emp.avatarUrl} size={32} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {emp.firstName} {emp.lastName}
        </p>
        <p className="text-xs text-gray-400 truncate">{emp.jobTitle}</p>
      </div>
      {alreadyInDept && <span className="text-xs text-gray-400 shrink-0">Already in dept</span>}
    </label>
  );
}
