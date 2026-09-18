'use client';

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { useEmployeeOptions } from '@/hooks/hr/useEmployees';
import { cn } from '@/lib/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  assignedIds: Set<string>;
  onAssign: (employeeIds: string[]) => void;
  isAssigning?: boolean;
}

export function AssignProjectMemberPanel({
  isOpen,
  onClose,
  assignedIds,
  onAssign,
  isAssigning,
}: Props) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: employees = [], isLoading } = useEmployeeOptions();

  const options = useMemo(
    () =>
      employees.filter(
        (e) =>
          (e.employmentStatus === 'ACTIVE' || e.employmentStatus === 'PROBATION') &&
          !assignedIds.has(e.id),
      ),
    [employees, assignedIds],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return options;
    return options.filter(
      (e) =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
        e.jobTitle?.toLowerCase().includes(q),
    );
  }, [options, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAssign = () => {
    if (selected.size === 0) return;
    onAssign(Array.from(selected));
    setSelected(new Set());
    setSearch('');
  };

  const handleClose = () => {
    setSelected(new Set());
    setSearch('');
    onClose();
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Assign Member"
      description="Select one or more employees to add to this project."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isAssigning}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={selected.size === 0}
            isLoading={isAssigning}
            loadingText="Assigning…"
          >
            Assign {selected.size > 0 ? `(${selected.size})` : ''}
          </Button>
        </div>
      }
    >
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or job title…"
          className="w-full h-9 pl-9 pr-4 border border-gray-200 rounded-input text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
        />
      </div>

      {/* Employee list */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">
          {search ? 'No employees match your search' : 'No available employees'}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {filtered.map((emp) => {
            const isChecked = selected.has(emp.id);
            return (
              <button
                key={emp.id}
                type="button"
                onClick={() => toggle(emp.id)}
                className={cn(
                  'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors',
                  isChecked ? 'bg-brand/5' : 'hover:bg-gray-50',
                )}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggle(emp.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4 rounded accent-brand shrink-0"
                />
                <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-brand">
                    {emp.firstName[0]}
                    {emp.lastName[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {emp.firstName} {emp.lastName}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{emp.jobTitle}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </SidePanel>
  );
}
