'use client';

import { useState } from 'react';
import { useUpdateEmployee } from '@/hooks/hr/useEmployees';
import { useAssignAsset } from '@/hooks/hr/useAssets';
import { useToast } from '@/hooks/useToast';
import { OffboardEmployeePanel } from './OffboardEmployeePanel';
import { ResignationPanel } from './resignationPanel';
import { EditEmployeePanel } from './EditEmployeePanel';
import { AssignAssetPanel } from './AssignAssetEmployeePanel';
import { EmployeePermissionsPanel } from '@/components/organisms/roles/EmployeePermissionsPanel';
import { AssignPermissionPanel } from '@/components/organisms/roles/assignPermissionPanel';
import type { Employee, EmployeeOption, UpdateEmployeePayload } from '@/types/hr';
import type { Asset } from '@/types/asset';
import type { PermissionSet } from '@/types/roles';

export type EmployeeDetailPanel =
  | 'edit'
  | 'offboard'
  | 'assign-asset'
  | 'roles'
  | 'permissions'
  | 'resign';

interface Props {
  activePanel: EmployeeDetailPanel | null;
  onClose: () => void;
  employee: Employee;
  allHrEmployees: EmployeeOption[];
  availableAssets: Asset[];
  customPermissionSets: PermissionSet[];
  assignedSets: { id: string; name: string }[];
  isAssigningPermissionSet: boolean;
  isRemovingPermissionSet: boolean;
  onAssignPermissionSet: (permissionSetId: string) => void;
  onRemovePermissionSet: (permissionSetId: string) => void;
}

export function EmployeeDetailPanels({
  activePanel,
  onClose,
  employee,
  allHrEmployees,
  availableAssets,
  customPermissionSets,
  assignedSets,
  isAssigningPermissionSet,
  isRemovingPermissionSet,
  onAssignPermissionSet,
  onRemovePermissionSet,
}: Props) {
  const [offboardChainOpen, setOffboardChainOpen] = useState(false);

  const toast = useToast();
  const { mutate: updateEmployee, isPending: isUpdating } = useUpdateEmployee();
  const { mutate: assignAsset } = useAssignAsset();

  const name = `${employee.firstName} ${employee.lastName}`;

  const handleUpdateEmployee = (data: UpdateEmployeePayload) => {
    updateEmployee(
      { id: employee.id, ...data },
      {
        onSuccess: () => {
          toast.success('Employee updated successfully');
          onClose();
        },
        onError: () => toast.error('Failed to update employee'),
      },
    );
  };

  const handleAssignAsset = (assetId: string) => {
    assignAsset(
      { assetId, employeeId: employee.id },
      {
        onSuccess: () => {
          toast.success('Asset assigned successfully');
          onClose();
        },
        onError: () => toast.error('Failed to assign asset'),
      },
    );
  };

  return (
    <>
      <ResignationPanel
        isOpen={activePanel === 'resign'}
        onClose={onClose}
        employee={employee}
        isHrView
        onAccept={() => {
          onClose();
          setOffboardChainOpen(true);
        }}
      />

      <OffboardEmployeePanel
        isOpen={activePanel === 'offboard' || offboardChainOpen}
        onClose={() => {
          setOffboardChainOpen(false);
          onClose();
        }}
        employeeId={employee.id}
        employeeName={name}
        assignedAssets={employee.assets ?? []}
      />

      <EditEmployeePanel
        isOpen={activePanel === 'edit'}
        onClose={onClose}
        employee={employee}
        employees={allHrEmployees}
        name={name}
        onSave={handleUpdateEmployee}
        isUpdating={isUpdating}
      />

      <AssignAssetPanel
        isOpen={activePanel === 'assign-asset'}
        onClose={onClose}
        employeeName={name}
        availableAssets={availableAssets.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          customType: a.customType,
          condition: a.condition ?? 'GOOD',
          assetNumber: a.assetNumber ?? '—',
        }))}
        onAssign={handleAssignAsset}
      />

      {employee.userId && (
        <EmployeePermissionsPanel
          isOpen={activePanel === 'roles'}
          onClose={onClose}
          employeeName={name}
          userId={employee.userId}
          availableSets={customPermissionSets}
          assignedSets={assignedSets}
          baseSetName={null}
          onAssign={onAssignPermissionSet}
          onRemove={onRemovePermissionSet}
          isAssigning={isAssigningPermissionSet}
          isRemoving={isRemovingPermissionSet}
        />
      )}

      {employee.userId && (
        <AssignPermissionPanel
          isOpen={activePanel === 'permissions'}
          onClose={onClose}
          employeeName={name}
          userId={employee.userId}
        />
      )}
    </>
  );
}
