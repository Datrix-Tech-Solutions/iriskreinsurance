'use client';

import { useState, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { useToast } from '@/hooks/useToast';
import { useUpdateEmployee } from '@/hooks';
import { cn } from '@/lib/utils';
import type { Branch, EmployeeOption } from '@/types/hr';
import { Icons } from '@/components/atoms/icons';

interface BranchMembersPanelProps {
  isOpen: boolean;
  onClose: () => void;
  branch: Branch | null;
  employees: EmployeeOption[];
}

export function BranchMembersPanel({
  isOpen,
  onClose,
  branch,
  employees,
}: BranchMembersPanelProps) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { mutateAsync: updateEmployeeAsync } = useUpdateEmployee();
  const { mutate: addMembers, isPending } = useMutation({
    mutationFn: async (branchId: string) => {
      await Promise.all(
        [...selectedIds].map((empId) => updateEmployeeAsync({ id: empId, branchId })),
      );
    },
    onSuccess: () => {
      toast.success('Members added successfully');
      handleClose();
    },
    onError: () => toast.error('Failed to add some members'),
  });

  const handleClose = () => {
    setSearch('');
    setSelectedIds(new Set());
    onClose();
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter((e) => {
      const name = `${e.firstName} ${e.lastName}`.toLowerCase();
      return !q || name.includes(q) || e.jobTitle?.toLowerCase().includes(q);
    });
  }, [employees, search]);

  const toggle = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Members"
      description={`Assign employees to "${branch?.name ?? ''}"`}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-gray-500">
            {selectedIds.size} employee{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              isLoading={isPending}
              loadingText="Adding…"
              disabled={selectedIds.size === 0}
              onClick={() => branch && addMembers(branch.id)}
            >
              Add Members
            </Button>
          </div>
        </div>
      }
    >
      {/* Search */}
      <div className="relative">
        <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search employees..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-input text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
        />
      </div>

      {/* Employee list */}
      <div className="flex flex-col divide-y divide-gray-100 -mx-6 px-6">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No employees found</p>
        ) : (
          filtered.map((emp) => {
            const checked = selectedIds.has(emp.id);
            const alreadyInBranch = emp.branch?.id === branch?.id;
            const initials = `${emp.firstName[0]}${emp.lastName[0]}`.toUpperCase();

            return (
              <label
                key={emp.id}
                className={cn(
                  'flex items-center gap-3 py-3 cursor-pointer hover:bg-gray-50 -mx-6 px-6 transition-colors',
                  alreadyInBranch && 'opacity-50 cursor-not-allowed',
                )}
              >
                <input
                  type="checkbox"
                  checked={checked || alreadyInBranch}
                  disabled={alreadyInBranch}
                  onChange={() => !alreadyInBranch && toggle(emp.id)}
                  className="w-4 h-4 rounded accent-brand shrink-0"
                />
                <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {emp.firstName} {emp.lastName}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{emp.jobTitle}</p>
                </div>
                {alreadyInBranch && (
                  <span className="text-xs text-gray-400 shrink-0">Already in branch</span>
                )}
              </label>
            );
          })
        )}
      </div>
    </SidePanel>
  );
}
