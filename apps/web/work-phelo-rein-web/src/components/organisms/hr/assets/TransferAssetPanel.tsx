'use client';

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { Icons } from '@/components/atoms/icons';
import { Asset } from '@/types/asset';
import { cn } from '@/lib/utils';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  employees: Employee[];
  onTransfer: (assetId: string, employeeId: string) => void;
}

export function TransferAssetPanel({ isOpen, onClose, asset, employees, onTransfer }: Props) {
  const [search, setSearch] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const eligibleEmployees = useMemo(
    () => employees.filter((e) => e.id !== asset?.assignedTo),
    [employees, asset?.assignedTo],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return eligibleEmployees;
    const q = search.toLowerCase();
    return eligibleEmployees.filter((e) => {
      const name = `${e.firstName} ${e.lastName}`.toLowerCase();
      return name.includes(q) || e.jobTitle?.toLowerCase().includes(q);
    });
  }, [eligibleEmployees, search]);

  const selectedEmployee = eligibleEmployees.find((e) => e.id === selectedEmployeeId) ?? null;

  const handleClose = () => {
    setSearch('');
    setSelectedEmployeeId(null);
    onClose();
  };

  const handleTransfer = () => {
    if (!asset || !selectedEmployeeId) return;
    onTransfer(asset.id, selectedEmployeeId);
    handleClose();
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Transfer Asset"
      description={asset ? `Transfer "${asset.name}" to a different employee.` : 'Transfer asset.'}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button disabled={!selectedEmployeeId} onClick={handleTransfer}>
            Transfer
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
        {/* Current owner */}
        {asset?.assignedEmployeeName && (
          <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
            <p className="text-sm font-bold text-gray-900">Current Owner</p>
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-card">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-gray-600">
                  {asset.assignedEmployeeName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
              </div>
              <p className="text-sm font-semibold text-gray-700">{asset.assignedEmployeeName}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">Transfer To</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or job title…"
              className="w-full h-10 pl-9 pr-4 border border-gray-300 rounded-input text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-1 focus:ring-brand/20 focus:border-brand"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No employees found</p>
          ) : (
            filtered.map((employee) => {
              const isSelected = selectedEmployeeId === employee.id;
              const fullName = `${employee.firstName} ${employee.lastName}`;
              return (
                <button
                  key={employee.id}
                  type="button"
                  onClick={() => setSelectedEmployeeId(isSelected ? null : employee.id)}
                  className={cn(
                    'w-full text-left flex items-center gap-3 px-4 py-3 rounded-card border transition-all',
                    isSelected
                      ? 'border-brand bg-brand-tint ring-1 ring-brand/20'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50',
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-orange-600">
                      {employee.firstName[0]}
                      {employee.lastName[0]}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{fullName}</p>
                    {employee.jobTitle && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{employee.jobTitle}</p>
                    )}
                  </div>
                  {isSelected && <Icons.Check />}
                </button>
              );
            })
          )}
        </div>

        {selectedEmployee && (
          <div className="flex items-center gap-2 px-4 py-3 bg-brand-tint rounded-card border border-brand/20">
            <Icons.Check />
            <p className="text-sm text-brand font-semibold truncate">
              {selectedEmployee.firstName} {selectedEmployee.lastName} selected
            </p>
          </div>
        )}
      </div>
    </SidePanel>
  );
}
