'use client';

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import {
  Employee,
  EmployeeOption,
  UpdateEmployeePayload,
  EmploymentType,
  EmploymentStatus,
  Gender,
  EmployeeCompensationType,
} from '@/types/hr';
import { NumberField } from '@/components/atoms/NumberField';
import { MonthPicker } from '@/components/atoms/endDatePicker';
import { useDepartmentOptions } from '@/hooks/hr/useDepartments';
import { useBranchOptions } from '@/hooks/hr/useBranches';
import { isAtLeastMinimumEmployeeAge, MIN_EMPLOYEE_AGE } from '@/lib/employeeAge';
import { useTenantConfig } from '@/hooks/useTenantConfig';

interface EditEmployeePanelProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  employees?: EmployeeOption[];
  name: string;
  onSave: (data: UpdateEmployeePayload) => void;
  isUpdating: boolean;
}

export function EditEmployeePanel({
  isOpen,
  onClose,
  employee,
  employees = [],
  name,
  onSave,
  isUpdating,
}: EditEmployeePanelProps) {
  const editForm = useForm<UpdateEmployeePayload>();
  const { reset } = editForm;
  const { data: departments = [] } = useDepartmentOptions(isOpen);
  const { data: branches = [] } = useBranchOptions(isOpen);
  const { currency: tenantCurrency } = useTenantConfig();

  // Watch values for controlled components
  const editDobValue = useWatch({ control: editForm.control, name: 'dateOfBirth' });
  const editDeptValue = useWatch({ control: editForm.control, name: 'departmentId' });
  const editBranchValue = useWatch({ control: editForm.control, name: 'branchId' });
  const editManagerValue = useWatch({ control: editForm.control, name: 'managerId' });
  const editTypeValue = useWatch({ control: editForm.control, name: 'employmentType' });
  const editStatusValue = useWatch({ control: editForm.control, name: 'employmentStatus' });
  const editGenderValue = useWatch({ control: editForm.control, name: 'gender' });
  const editHireDateValue = useWatch({ control: editForm.control, name: 'hireDate' });
  const basicSalaryValue = useWatch({ control: editForm.control, name: 'basicSalary' });
  const compensationTypeValue =
    useWatch({ control: editForm.control, name: 'compensationType' }) ?? 'SALARY';
  const probationValue = useWatch({ control: editForm.control, name: 'probationEndsAt' });
  const contractEndValue = useWatch({ control: editForm.control, name: 'contractEndDate' });

  // Reset form when employee data changes
  useEffect(() => {
    if (!employee) return;
    reset({
      firstName: employee.firstName,
      lastName: employee.lastName,
      phone: employee.phone ?? '',
      jobTitle: employee.jobTitle,
      departmentId: employee.departmentId ?? '',
      branchId: employee.branchId ?? '',
      managerId: employee.managerId ?? '',
      employmentType: employee.employmentType,
      employmentStatus: employee.employmentStatus,
      hireDate: employee.hireDate ?? '',
      dateOfBirth: employee.dateOfBirth ?? '',
      gender: employee.gender ?? undefined,
      maritalStatus: employee.maritalStatus ?? undefined,
      nationality: employee.nationality ?? '',
      nationalId: employee.nationalId ?? '',
      address: employee.address ?? '',
      city: employee.city ?? '',
      region: employee.region ?? '',
      emergencyName: employee.emergencyName ?? '',
      emergencyPhone: employee.emergencyPhone ?? '',
      emergencyRelation: employee.emergencyRelation ?? '',
      basicSalary: employee.basicSalary,
      compensationType: employee.compensationType ?? 'SALARY',
      bankName: employee.bankName ?? '',
      bankAccountNumber: employee.bankAccountNumber ?? '',
      bankBranch: employee.bankBranch ?? '',
      ssnit: employee.ssnit ?? '',
      tinNumber: employee.tinNumber ?? '',
      probationEndsAt: employee.probationEndsAt ?? '',
      contractEndDate: employee.contractEndDate ?? '',
    });
  }, [employee, reset]);

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Employee"
      description={`Editing ${name}`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            isLoading={isUpdating}
            loadingText="Saving…"
            onClick={editForm.handleSubmit((data) => {
              if (data.dateOfBirth && !isAtLeastMinimumEmployeeAge(data.dateOfBirth)) {
                editForm.setError('dateOfBirth', {
                  type: 'validate',
                  message: `Employee must be at least ${MIN_EMPLOYEE_AGE} years old`,
                });
                return;
              }

              editForm.clearErrors('dateOfBirth');
              const dateFields = ['dateOfBirth', 'hireDate'] as const;
              for (const field of dateFields) {
                if (!data[field]) data[field] = undefined;
              }
              const monthFields = ['probationEndsAt', 'contractEndDate'] as const;
              for (const field of monthFields) {
                if (!data[field]) {
                  data[field] = undefined;
                } else if (data[field]!.length === 7) {
                  data[field] = `${data[field]}-01`;
                }
              }
              const relationFields = ['departmentId', 'branchId', 'managerId'] as const;
              for (const field of relationFields) {
                if (!data[field]) data[field] = undefined;
              }
              onSave(data);
            })}
          >
            Save Changes
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Personal Information
        </p>
        <FormField
          label="First Name"
          registration={editForm.register('firstName', { required: 'Required' })}
          error={editForm.formState.errors.firstName}
          placeholder="eg; Kofi"
        />
        <FormField
          label="Last Name"
          registration={editForm.register('lastName', { required: 'Required' })}
          error={editForm.formState.errors.lastName}
          placeholder="eg; Boateng"
        />

        <DatePicker
          label="Date of Birth"
          value={editDobValue}
          onChange={(v) => {
            editForm.setValue('dateOfBirth', v);
            editForm.clearErrors('dateOfBirth');
          }}
          error={editForm.formState.errors.dateOfBirth?.message}
          disableFuture
        />
        <SearchSelect
          label="Gender"
          placeholder="Select gender"
          value={editGenderValue}
          onChange={(v) => editForm.setValue('gender', v as Gender)}
          options={[
            { value: 'MALE', label: 'Male' },
            { value: 'FEMALE', label: 'Female' },
          ]}
        />
        <FormField
          label="Address"
          registration={editForm.register('address')}
          placeholder="eg; 12 Accra Road"
        />
        <FormField label="City" registration={editForm.register('city')} placeholder="eg; Accra" />
        <FormField
          label="Region"
          registration={editForm.register('region')}
          placeholder="eg; Greater Accra"
        />
      </div>
      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Job Information
        </p>
        <FormField
          label="Job Title"
          registration={editForm.register('jobTitle', { required: 'Required' })}
          error={editForm.formState.errors.jobTitle}
          placeholder="eg; UI/UX Engineer"
        />
        <SearchSelect
          label="Department"
          placeholder="Select department"
          value={editDeptValue}
          onChange={(v) => editForm.setValue('departmentId', v)}
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
        />
        {branches.length > 0 && (
          <SearchSelect
            label="Branch"
            placeholder="Select branch (optional)"
            value={editBranchValue}
            onChange={(v) => editForm.setValue('branchId', v)}
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
          />
        )}
        {employees.length > 0 && (
          <SearchSelect
            label="Reporting Manager"
            placeholder="Select manager (optional)"
            value={editManagerValue}
            onChange={(v) => editForm.setValue('managerId', v)}
            options={employees
              .filter((e) => e.id !== employee.id)
              .map((e) => ({
                value: e.id,
                label: `${e.firstName} ${e.lastName}`,
                sublabel: e.jobTitle,
              }))}
          />
        )}
        <DatePicker
          label="Date Hired"
          value={editHireDateValue}
          onChange={(v) => editForm.setValue('hireDate', v)}
          disableFuture
        />
        <SearchSelect
          label="Employment Type"
          placeholder="Select type"
          value={editTypeValue}
          onChange={(v) => editForm.setValue('employmentType', v as EmploymentType)}
          options={[
            { value: 'FULL_TIME', label: 'Full Time' },
            { value: 'PART_TIME', label: 'Part Time' },
            { value: 'CONTRACT', label: 'Contract' },
            { value: 'INTERN', label: 'Intern' },
          ]}
        />
        <SearchSelect
          label="Employment Status"
          placeholder="Select status"
          value={editStatusValue}
          onChange={(v) => editForm.setValue('employmentStatus', v as EmploymentStatus)}
          options={[
            { value: 'ACTIVE', label: 'Active' },
            { value: 'PROBATION', label: 'Probation' },
            { value: 'SUSPENDED', label: 'Suspended' },
          ]}
        />
        {editTypeValue !== 'CONTRACT' && (
          <MonthPicker
            label="Probation End Date"
            value={probationValue}
            onChange={(v) => editForm.setValue('probationEndsAt', v)}
            disablePast={true}
          />
        )}
        {editTypeValue === 'CONTRACT' && (
          <MonthPicker
            label="Contract End Date"
            value={contractEndValue}
            onChange={(v) => editForm.setValue('contractEndDate', v)}
            disablePast={true}
          />
        )}
      </div>

      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Banking & Compliance
        </p>
        <SearchSelect
          label="Compensation Type"
          placeholder="Select compensation type"
          value={compensationTypeValue}
          onChange={(v) => editForm.setValue('compensationType', v as EmployeeCompensationType)}
          options={[
            { value: 'SALARY', label: 'Salary' },
            { value: 'COMMISSION', label: 'Commission' },
            { value: 'SALARY_PLUS_COMMISSION', label: 'Salary + Commission' },
          ]}
        />
        {(compensationTypeValue === 'SALARY' ||
          compensationTypeValue === 'SALARY_PLUS_COMMISSION') && (
          <NumberField
            label={`Basic Salary (${tenantCurrency})`}
            value={basicSalaryValue ?? 0}
            onChange={(n) => editForm.setValue('basicSalary', n === 0 ? undefined : n)}
            placeholder="0.00"
          />
        )}
      </div>
    </SidePanel>
  );
}
