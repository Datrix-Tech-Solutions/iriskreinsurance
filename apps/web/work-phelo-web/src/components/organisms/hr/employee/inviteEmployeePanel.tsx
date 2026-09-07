'use client';

import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { PhoneInput } from '@/components/atoms/PhoneInput';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { Employee, CreateEmployeePayload } from '@/types/hr';
import { useCreateEmployee } from '@/hooks/hr/useEmployees';
import { useDepartmentOptions } from '@/hooks/hr/useDepartments';
import { useBranchOptions } from '@/hooks/hr/useBranches';
import { useCompanyPoliciesSettings } from '@/hooks';
import { MonthPicker } from '@/components/atoms/endDatePicker';
import { usePermissionSets, useAssignPermissionSet } from '@/hooks/hr/useRoles';
import { NumberField } from '@/components/atoms/NumberField';
import { useTenantConfig } from '@/hooks/useTenantConfig';
import type { EmployeeCompensationType } from '@/types/hr';

/* ── Types ── */

interface InviteForm {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  gender?: string;
  jobTitle: string;
  departmentId?: string;
  branchId?: string;
  managerId?: string;
  employmentType: string;
  hireDate: string;
  probationEndsAt?: string;
  contractEndDate?: string;
  basicSalary?: number;
  compensationType?: EmployeeCompensationType;
}

interface InviteEmployeePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (fullName: string) => void;
  employees: Employee[];
}

function InviteEmployeeForm({ isOpen, onClose, onSuccess, employees }: InviteEmployeePanelProps) {
  const toast = useToast();
  const { data: departments = [] } = useDepartmentOptions(true);
  const { data: branches = [] } = useBranchOptions(true);
  const { data: policiesSettings } = useCompanyPoliciesSettings();
  const { currency: tenantCurrency } = useTenantConfig();
  const { data: permissionSetsRaw = [] } = usePermissionSets();
  const { mutateAsync: assignPermissionSet } = useAssignPermissionSet();
  const [selectedPermissionSetId, setSelectedPermissionSetId] = useState('');

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<InviteForm>({
    defaultValues: {
      employmentType: 'FULL_TIME',
      phone: '',
      compensationType: 'SALARY',
    },
  });

  const phoneValue = useWatch({ control, name: 'phone' });
  const hireDateValue = useWatch({ control, name: 'hireDate' });
  const probationDateValue = useWatch({ control, name: 'probationEndsAt' });
  const contractDateValue = useWatch({ control, name: 'contractEndDate' });
  const deptFormValue = useWatch({ control, name: 'departmentId' });
  const branchFormValue = useWatch({ control, name: 'branchId' });
  const managerValue = useWatch({ control, name: 'managerId' });
  const employmentTypeValue = useWatch({ control, name: 'employmentType' });
  const genderValue = useWatch({ control, name: 'gender' });
  const basicSalaryValue = useWatch({ control, name: 'basicSalary' });
  const compensationTypeValue = useWatch({ control, name: 'compensationType' }) ?? 'SALARY';

  useEffect(() => {
    if (
      employmentTypeValue === 'CONTRACT' ||
      employmentTypeValue === 'INTERN' ||
      !hireDateValue ||
      policiesSettings === undefined
    ) {
      return;
    }

    const probationMonths = policiesSettings.defaultProbationPeriodMonths ?? 3;
    if (!probationMonths) return;

    const hireDate = new Date(hireDateValue);
    if (isNaN(hireDate.getTime())) return;

    const probationDate = new Date(
      hireDate.getFullYear(),
      hireDate.getMonth() + probationMonths,
      1,
    );
    const probationMonth = `${probationDate.getFullYear()}-${String(
      probationDate.getMonth() + 1,
    ).padStart(2, '0')}`;

    setValue('probationEndsAt', probationMonth);
  }, [employmentTypeValue, hireDateValue, policiesSettings, setValue]);

  const { mutateAsync: createEmployee, isPending } = useCreateEmployee();

  const onSubmit = async (d: InviteForm) => {
    const normalized = { ...d };
    if (normalized.probationEndsAt?.length === 7) normalized.probationEndsAt += '-01';
    if (normalized.contractEndDate?.length === 7) normalized.contractEndDate += '-01';

    const payload = Object.fromEntries(
      Object.entries(normalized).filter(([, v]) => v !== '' && v !== undefined && v !== null),
    ) as unknown as CreateEmployeePayload;

    try {
      const employee = await createEmployee(payload);
      if (selectedPermissionSetId && employee.userId) {
        await assignPermissionSet({
          userId: employee.userId,
          permissionSetId: selectedPermissionSetId,
        });
      }
      reset({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        gender: undefined,
        jobTitle: '',
        departmentId: undefined,
        branchId: undefined,
        managerId: undefined,
        employmentType: 'FULL_TIME',
        hireDate: undefined,
        probationEndsAt: undefined,
        contractEndDate: undefined,
        basicSalary: undefined,
        compensationType: 'SALARY',
      });
      setSelectedPermissionSetId('');
      onClose();
      onSuccess(`${d.firstName} ${d.lastName}`);
    } catch (err) {
      toast.error(extractError(err, 'Failed to invite employee'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Employee"
      description="Add a new employee to onboard them onto WorkPhelo."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            isLoading={isPending}
            loadingText="Sending invite…"
            onClick={handleSubmit(onSubmit)}
          >
            Send Invite
          </Button>
        </div>
      }
    >
      {/* Personal Information */}
      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Personal Information
        </p>
        <FormField
          label="First Name"
          registration={register('firstName', { required: 'Required' })}
          error={errors.firstName}
          placeholder="eg; Kofi"
        />
        <FormField
          label="Last Name"
          registration={register('lastName', { required: 'Required' })}
          error={errors.lastName}
          placeholder="eg; Boateng"
        />
        <FormField
          label="Work Email"
          registration={register('email', {
            required: 'Required',
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' },
          })}
          error={errors.email}
          type="email"
          placeholder="eg; kofi@acmecorp.com"
        />
        <PhoneInput
          label="Phone Number"
          placeholder="00 000 0000"
          value={phoneValue}
          onChange={(v) => setValue('phone', v)}
        />
        <SearchSelect
          label="Gender"
          placeholder="Select gender"
          value={genderValue}
          onChange={(v) => setValue('gender', v)}
          options={[
            { value: 'MALE', label: 'Male' },
            { value: 'FEMALE', label: 'Female' },
          ]}
        />
      </div>

      {/* Job Information */}
      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Job Information
        </p>
        {departments.length > 0 && (
          <SearchSelect
            label="Department"
            placeholder="Select department"
            value={deptFormValue}
            onChange={(v) => setValue('departmentId', v)}
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
          />
        )}
        {branches.length > 0 && (
          <SearchSelect
            label="Branch"
            placeholder="Select branch (optional)"
            value={branchFormValue}
            onChange={(v) => setValue('branchId', v)}
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
          />
        )}
        <FormField
          label="Job Title"
          registration={register('jobTitle', { required: 'Required' })}
          error={errors.jobTitle}
          placeholder="eg; UI/UX Engineer"
        />
        <SearchSelect
          label="Reporting Manager"
          placeholder="Select manager (optional)"
          value={managerValue}
          onChange={(v) => setValue('managerId', v)}
          options={employees.map((e) => ({
            value: e.id,
            label: `${e.firstName} ${e.lastName}`,
            sublabel: e.jobTitle,
          }))}
        />
        <DatePicker
          label="Date Hired"
          value={hireDateValue}
          onChange={(v) => setValue('hireDate', v)}
          error={errors.hireDate?.message}
          disableFuture
        />
        <SearchSelect
          label="Employment Type"
          placeholder="Select employment type"
          value={employmentTypeValue}
          onChange={(v) => setValue('employmentType', v)}
          options={[
            { value: 'FULL_TIME', label: 'Full Time' },
            { value: 'PART_TIME', label: 'Part Time' },
            { value: 'CONTRACT', label: 'Contract' },
            { value: 'INTERN', label: 'Intern' },
          ]}
        />
        {employmentTypeValue !== 'CONTRACT' && employmentTypeValue !== 'INTERN' && (
          <MonthPicker
            label="Probation End Date"
            value={probationDateValue}
            onChange={(v) => setValue('probationEndsAt', v)}
            disablePast={true}
          />
        )}
        {(employmentTypeValue === 'CONTRACT' || employmentTypeValue === 'INTERN') && (
          <MonthPicker
            label={employmentTypeValue === 'INTERN' ? 'Internship End Date' : 'Contract End Date'}
            value={contractDateValue}
            onChange={(v) => setValue('contractEndDate', v)}
            disablePast={true}
          />
        )}
        {permissionSetsRaw.length > 0 && (
          <SearchSelect
            label="Roles"
            placeholder="Select roles"
            value={selectedPermissionSetId}
            onChange={setSelectedPermissionSetId}
            options={permissionSetsRaw.map((s) => ({ value: s.id, label: s.name }))}
          />
        )}
      </div>

      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Payroll Profile
        </p>
        <SearchSelect
          label="Compensation Type"
          placeholder="Select compensation type"
          value={compensationTypeValue}
          onChange={(v) => setValue('compensationType', v as EmployeeCompensationType)}
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
            onChange={(n) => setValue('basicSalary', n === 0 ? undefined : n)}
            placeholder="0.00"
          />
        )}
      </div>
    </SidePanel>
  );
}

export function InviteEmployeePanel(props: InviteEmployeePanelProps) {
  return <InviteEmployeeForm {...props} />;
}
