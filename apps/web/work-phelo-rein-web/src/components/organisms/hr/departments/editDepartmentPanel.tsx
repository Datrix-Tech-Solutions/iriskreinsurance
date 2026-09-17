'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useEmployeeOptions, useUpdateEmployee } from '@/hooks/hr/useEmployees';

import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import {
  DepartmentFormFields,
  DeptForm,
} from '@/components/molecules/hr/departments/DepartmentFormFields';
import { useDepartments, useUpdateDepartment } from '@/hooks/hr/useDepartments';
import { useToast } from '@/hooks/useToast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editTarget: {
    id: string;
    name: string;
    description?: string;
    managerId?: string;
  } | null;
}

export function EditDepartmentPanel({ isOpen, onClose, editTarget }: Props) {
  const toast = useToast();
  const form = useForm<DeptForm>();
  const { mutateAsync: updateDepartmentAsync, isPending } = useUpdateDepartment();
  const { mutate: updateEmployee } = useUpdateEmployee();

  const { data: employees = [] } = useEmployeeOptions();
  const { data: departments = [] } = useDepartments();

  useEffect(() => {
    if (editTarget) {
      form.reset({
        name: editTarget.name,
        description: editTarget.description,
        managerId: editTarget.managerId,
      });
    }
  }, [editTarget, form, isOpen]);

  const handleSubmit = async (data: DeptForm) => {
    if (!editTarget) return;

    const newManagerId = data.managerId || null;

    try {
      // If a new manager is being set, clear their headship in any other department first
      if (newManagerId) {
        const prevHeadOf = departments.find(
          (d) => d.managerId === newManagerId && d.id !== editTarget.id,
        );
        if (prevHeadOf) {
          await updateDepartmentAsync({ id: prevHeadOf.id, managerId: null });
        }
      }

      await updateDepartmentAsync({
        id: editTarget.id,
        name: data.name,
        description: data.description || undefined,
        managerId: newManagerId,
      });

      // Auto-add the new manager as a member of this department
      if (newManagerId) {
        const manager = employees.find((e) => e.id === newManagerId);
        if (manager && manager.department?.id !== editTarget.id) {
          updateEmployee({ id: newManagerId, departmentId: editTarget.id });
        }
      }

      toast.success('Department updated successfully');
      onClose();
    } catch {
      toast.error('Failed to update department');
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Department"
      description={`Editing "${editTarget?.name}"`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            isLoading={isPending}
            loadingText="Saving..."
            onClick={form.handleSubmit(handleSubmit)}
          >
            Save Changes
          </Button>
        </div>
      }
    >
      <DepartmentFormFields form={form} employees={employees} />
    </SidePanel>
  );
}
