'use client';

import { useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import type { PermissionSet } from '@/types/roles';

interface EmployeePermissionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  employeeName: string;
  /** Auth user ID — needed for the assign/remove calls */
  userId: string;
  /** All permission sets available in this tenant */
  availableSets: PermissionSet[];
  /** Permission sets already assigned to this user */
  assignedSets: { id: string; name: string }[];
  /** Optional baseline set name when a user has non-removable system access */
  baseSetName?: string | null;
  onAssign: (permissionSetId: string) => void;
  onRemove: (permissionSetId: string) => void;
  isAssigning: boolean;
  isRemoving: boolean;
}

export function EmployeePermissionsPanel({
  isOpen,
  onClose,
  employeeName,
  assignedSets,
  availableSets,
  baseSetName,
  onAssign,
  onRemove,
  isAssigning,
  isRemoving,
}: EmployeePermissionsPanelProps) {
  const [selectedSetId, setSelectedSetId] = useState('');

  const assignedIds = new Set(assignedSets.map((s) => s.id));

  // Only show sets not already assigned
  const assignableOptions = availableSets
    .filter((s) => !assignedIds.has(s.id))
    .map((s) => ({ value: s.id, label: s.name }));

  const handleAssign = () => {
    if (!selectedSetId) return;
    onAssign(selectedSetId);
    setSelectedSetId('');
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Permission Sets"
      description={`Assign reusable permission sets to ${employeeName} and remove them when access is no longer needed.`}
    >
      {/* Currently assigned */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold text-gray-900">Assigned permission sets</p>

        {assignedSets.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No permission sets assigned yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {assignedSets.map((set) => {
              const isBase = set.name === baseSetName;
              return (
                <div
                  key={set.id}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-3.5 h-3.5 text-brand" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{set.name}</p>
                      {isBase && (
                        <p className="text-xs text-gray-400">
                          System access inherited from role — cannot be removed here
                        </p>
                      )}
                    </div>
                  </div>
                  {!isBase && (
                    <button
                      onClick={() => onRemove(set.id)}
                      disabled={isRemoving}
                      className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                      aria-label="Remove"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add new */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-bold text-gray-900">Add permission set</p>
        <SearchSelect
          placeholder="Select a custom permission set..."
          options={assignableOptions}
          value={selectedSetId}
          onChange={setSelectedSetId}
        />
        <Button
          onClick={handleAssign}
          disabled={!selectedSetId}
          isLoading={isAssigning}
          loadingText="Assigning..."
          variant="secondary"
        >
          Assign
        </Button>
      </div>
    </SidePanel>
  );
}
