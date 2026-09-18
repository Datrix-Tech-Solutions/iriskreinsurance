'use client';

import { useEffect, useRef, useState } from 'react';
import { extractError } from '@/lib/extractError';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import {
  useCreateAppraisalCycle,
  useUpdateAppraisalCycle,
  useAppraisalTemplates,
  useAppraisalSettings,
} from '@/hooks';
import { useDepartments, useEmployeeOptions, usePermissionSets } from '@/hooks';
import type { PermissionSet } from '@/types/roles';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import type {
  AppraisalCycle,
  AppraisalEligibleEmploymentStatus,
  CreateAppraisalCycleDto,
  Frequency,
} from '@/types/hr';
import { Icons } from '@/components/atoms/icons';
import { MultiSelect } from '@/components/atoms/MultiSelect';

const FREQUENCY_OPTIONS = [
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'SEMI_ANNUAL', label: 'Semi-annual' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'AD_HOC', label: 'Ad-hoc' },
];

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: 'FULL_TIME', label: 'Full Time' },
  { value: 'PART_TIME', label: 'Part Time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERN', label: 'Intern' },
];

const EMPLOYMENT_STATUS_OPTIONS: {
  value: AppraisalEligibleEmploymentStatus;
  label: string;
}[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PROBATION', label: 'Probation' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

interface CreateCyclePanelProps {
  isOpen: boolean;
  onClose: () => void;
  editCycle?: AppraisalCycle;
  forceCreate?: boolean;
}

type FormValues = {
  title: string;
  description: string;
  frequency: Frequency | '';
  startDate: string;
  endDate: string;
  selfAssessmentDeadline: string;
  managerReviewDeadline: string;
  templateId: string;
  departmentIds: string[];
  employmentTypes: string[];
  useCompanyDefaultEligibility: boolean;
  employmentStatuses: AppraisalEligibleEmploymentStatus[];
  permissionSetIds: string[];
  selectSpecificEmployees: boolean;
  employeeIds: string[];
};

/* ── Employment type multi-select ── */
function EmploymentTypeSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (types: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && dropdownRef.current) {
      dropdownRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [open]);

  const allSelected = value.length === 0;
  const label = allSelected
    ? 'All employment types'
    : EMPLOYMENT_TYPE_OPTIONS.filter((o) => value.includes(o.value))
        .map((o) => o.label)
        .join(', ');

  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((t) => t !== v) : [...value, v]);

  return (
    <div className="flex flex-col gap-(--field-label-gap,0.125rem) relative" ref={ref}>
      <label className="text-sm font-medium text-gray-700">Employment Type</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center justify-between w-full px-4 py-3 border rounded-input bg-white text-sm transition-colors',
          open ? 'border-brand ring-1 ring-brand/20' : 'border-gray-300',
        )}
      >
        <span className="text-gray-900 truncate">{label}</span>
        <Icons.ChevronDown
          className={cn(
            'text-gray-400 transition-transform duration-150 shrink-0',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 mt-1.5 w-full bg-white border border-gray-200 rounded-card shadow-xl z-50 overflow-hidden"
        >
          <div className="py-1">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onChange([])}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-gray-50"
            >
              <span
                className={cn(
                  'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                  allSelected ? 'bg-brand border-brand' : 'border-gray-300 bg-white',
                )}
              >
                {allSelected && <Icons.Check className="w-2.5 h-2.5 text-white" />}
              </span>
              All Types
            </button>
            {EMPLOYMENT_TYPE_OPTIONS.map((opt) => {
              const checked = value.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => toggle(opt.value)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-gray-50"
                >
                  <span
                    className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                      checked ? 'bg-brand border-brand' : 'border-gray-300 bg-white',
                    )}
                  >
                    {checked && <Icons.Check className="w-2.5 h-2.5 text-white" />}
                  </span>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function EmploymentStatusSelect({
  value,
  onChange,
}: {
  value: AppraisalEligibleEmploymentStatus[];
  onChange: (statuses: AppraisalEligibleEmploymentStatus[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && dropdownRef.current) {
      dropdownRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [open]);

  const label = value.length
    ? EMPLOYMENT_STATUS_OPTIONS.filter((option) => value.includes(option.value))
        .map((option) => option.label)
        .join(', ')
    : 'Select employment statuses';

  const toggle = (status: AppraisalEligibleEmploymentStatus) =>
    onChange(
      value.includes(status) ? value.filter((entry) => entry !== status) : [...value, status],
    );

  return (
    <div className="flex flex-col gap-(--field-label-gap,0.125rem) relative" ref={ref}>
      <label className="text-sm font-medium text-gray-700">Employment Status Eligibility</label>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex items-center justify-between w-full px-4 py-3 border rounded-input bg-white text-sm transition-colors',
          open ? 'border-brand ring-1 ring-brand/20' : 'border-gray-300',
        )}
      >
        <span className="text-gray-900 truncate">{label}</span>
        <Icons.ChevronDown
          className={cn(
            'text-gray-400 transition-transform duration-150 shrink-0',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 mt-1.5 w-full bg-white border border-gray-200 rounded-card shadow-xl z-50 overflow-hidden"
        >
          <div className="py-1">
            {EMPLOYMENT_STATUS_OPTIONS.map((option) => {
              const checked = value.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => toggle(option.value)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-gray-50"
                >
                  <span
                    className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                      checked ? 'bg-brand border-brand' : 'border-gray-300 bg-white',
                    )}
                  >
                    {checked && <Icons.Check className="w-2.5 h-2.5 text-white" />}
                  </span>
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Specific employees multi-select ── */
function EmployeeSelect({
  value,
  onChange,
  departmentIds,
  employmentStatuses,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  departmentIds: string[];
  employmentStatuses: string[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { data: employees = [] } = useEmployeeOptions();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = employees
    .filter(
      (emp) =>
        departmentIds.length === 0 ||
        (emp.department?.id != null && departmentIds.includes(emp.department.id)),
    )
    .filter(
      (emp) => employmentStatuses.length === 0 || employmentStatuses.includes(emp.employmentStatus),
    )
    .filter((emp) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        emp.firstName.toLowerCase().includes(q) ||
        emp.lastName.toLowerCase().includes(q) ||
        emp.email.toLowerCase().includes(q)
      );
    });

  useEffect(() => {
    if (open && dropdownRef.current) {
      dropdownRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [open]);

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  const selectedEmployees = employees.filter((e) => value.includes(e.id));

  return (
    <div className="flex flex-col gap-(--field-label-gap,0.125rem) relative" ref={ref}>
      <label className="text-sm font-medium text-gray-700">Specific Employees</label>

      {selectedEmployees.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedEmployees.map((emp) => (
            <span
              key={emp.id}
              className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-medium px-2 py-1 rounded-full"
            >
              {emp.firstName} {emp.lastName}
              <button
                type="button"
                onClick={() => toggle(emp.id)}
                className="hover:text-blue-900 transition-colors"
              >
                <Icons.X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center justify-between w-full px-4 py-3 border rounded-input bg-white text-sm transition-colors',
          open ? 'border-brand ring-1 ring-brand/20' : 'border-gray-300',
        )}
      >
        <span className="text-gray-900">
          {selectedEmployees.length > 0 ? 'Add more employees…' : 'Search and select employees'}
        </span>
        <Icons.ChevronDown
          className={cn('text-gray-400 transition-transform duration-150', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 mt-1.5 w-full bg-white border border-gray-200 rounded-card shadow-xl z-50 overflow-hidden"
        >
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="Search employees…"
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded focus:outline-none focus:border-brand"
            />
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400 text-center">No employees found</p>
            ) : (
              filtered.map((emp) => {
                const checked = value.includes(emp.id);
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => toggle(emp.id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-gray-50"
                  >
                    <span
                      className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                        checked ? 'bg-brand border-brand' : 'border-gray-300 bg-white',
                      )}
                    >
                      {checked && <Icons.Check className="w-2.5 h-2.5 text-white" />}
                    </span>
                    <span className="flex flex-col text-left">
                      <span>
                        {emp.firstName} {emp.lastName}
                      </span>
                      <span className="text-xs text-gray-400">{emp.jobTitle}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main panel ── */
export function CreateCyclePanel({
  isOpen,
  onClose,
  editCycle,
  forceCreate,
}: CreateCyclePanelProps) {
  const toast = useToast();
  const isEditing = !!editCycle && !forceCreate;

  const { data: templates = [] } = useAppraisalTemplates();
  const { data: appraisalSettings } = useAppraisalSettings();
  const templateOptions = templates.map((t) => ({ value: t.id, label: t.name }));

  const { data: departments = [] } = useDepartments();
  const deptOptions = departments.map((d) => ({ value: d.id, label: d.name }));

  const { data: rawSets = [] } = usePermissionSets();
  const permSetOptions = rawSets
    .filter((s: PermissionSet) => !s.isSystem)
    .map((s: PermissionSet) => ({ value: s.id, label: s.name }));

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      title: '',
      description: '',
      frequency: '',
      startDate: '',
      endDate: '',
      selfAssessmentDeadline: '',
      managerReviewDeadline: '',
      templateId: '',
      departmentIds: [],
      employmentTypes: [],
      useCompanyDefaultEligibility: true,
      employmentStatuses: [],
      permissionSetIds: [],
      selectSpecificEmployees: false,
      employeeIds: [],
    },
  });

  useEffect(() => {
    if (editCycle) {
      reset({
        title: editCycle.title,
        description: editCycle.description ?? '',
        frequency: editCycle.frequency ?? '',
        startDate: editCycle.startDate.slice(0, 10),
        endDate: editCycle.endDate.slice(0, 10),
        selfAssessmentDeadline: editCycle.selfAssessmentDeadline?.slice(0, 10) ?? '',
        managerReviewDeadline: editCycle.managerReviewDeadline?.slice(0, 10) ?? '',
        templateId: editCycle.templateId ?? '',
        departmentIds: editCycle.departmentIds ?? [],
        employmentTypes: editCycle.employmentTypes ?? [],
        useCompanyDefaultEligibility: (editCycle.employmentStatuses?.length ?? 0) === 0,
        employmentStatuses: editCycle.employmentStatuses ?? [],
        permissionSetIds: (editCycle as { permissionSetIds?: string[] }).permissionSetIds ?? [],
        selectSpecificEmployees: (editCycle.employeeIds?.length ?? 0) > 0,
        employeeIds: editCycle.employeeIds ?? [],
      });
    } else {
      reset({
        title: '',
        description: '',
        frequency: '',
        startDate: '',
        endDate: '',
        selfAssessmentDeadline: '',
        managerReviewDeadline: '',
        templateId: '',
        departmentIds: [],
        employmentTypes: [],
        useCompanyDefaultEligibility: true,
        employmentStatuses: [],
        permissionSetIds: [],
        selectSpecificEmployees: false,
        employeeIds: [],
      });
    }
  }, [editCycle, reset]);

  const startDate = useWatch({ control, name: 'startDate' });
  const useCompanyDefaultEligibility = useWatch({ control, name: 'useCompanyDefaultEligibility' });
  const selectSpecificEmployees = useWatch({ control, name: 'selectSpecificEmployees' });
  const watchedDepartmentIds = useWatch({ control, name: 'departmentIds' });
  const watchedEmploymentStatuses = useWatch({ control, name: 'employmentStatuses' });

  const { mutate: createCycle, isPending: isCreating } = useCreateAppraisalCycle();
  const { mutate: updateCycle, isPending: isUpdating } = useUpdateAppraisalCycle();
  const isPending = isCreating || isUpdating;

  const onSubmit = (values: FormValues) => {
    if (!values.selfAssessmentDeadline || !values.managerReviewDeadline) {
      toast.error('Self-assessment and manager review deadlines are required');
      return;
    }

    const payload: Partial<CreateAppraisalCycleDto> & { permissionSetIds?: string[] } = {
      title: values.title,
      description: values.description || undefined,
      frequency: (values.frequency as Frequency) || undefined,
      startDate: values.startDate,
      endDate: values.endDate,
      selfAssessmentDeadline: values.selfAssessmentDeadline || undefined,
      managerReviewDeadline: values.managerReviewDeadline || undefined,
      templateId: values.templateId || undefined,
      departmentIds: values.departmentIds.length > 0 ? values.departmentIds : undefined,
      employmentTypes: values.employmentTypes.length > 0 ? values.employmentTypes : undefined,
      employmentStatuses: values.useCompanyDefaultEligibility ? [] : values.employmentStatuses,
      permissionSetIds: values.permissionSetIds.length > 0 ? values.permissionSetIds : undefined,
      employeeIds:
        values.selectSpecificEmployees && values.employeeIds.length > 0
          ? values.employeeIds
          : undefined,
    };

    const options = {
      onSuccess: () => {
        toast.success(isEditing ? 'Cycle updated' : 'Cycle created');
        reset({
          title: '',
          description: '',
          frequency: '',
          startDate: '',
          endDate: '',
          selfAssessmentDeadline: '',
          managerReviewDeadline: '',
          templateId: '',
          departmentIds: [],
          employmentTypes: [],
          useCompanyDefaultEligibility: true,
          employmentStatuses: [],
          permissionSetIds: [],
          selectSpecificEmployees: false,
          employeeIds: [],
        });
        onClose();
      },
      onError: (err: unknown) => toast.error(extractError(err, 'Something went wrong')),
    };

    if (isEditing) {
      updateCycle({ id: editCycle!.id, ...payload }, options);
    } else {
      createCycle(payload, options);
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={
        isEditing
          ? 'Edit Appraisal Cycle'
          : forceCreate
            ? 'New Cycle from Cancelled'
            : 'Add New Appraisal Cycle'
      }
      description="Schedule a performance review cycle for your organisation."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving..." onClick={handleSubmit(onSubmit)}>
            {isEditing ? 'Save Changes' : 'Create Cycle'}
          </Button>
        </div>
      }
    >
      {/* Cycle name */}
      <FormField
        label="Cycle name"
        registration={register('title', { required: 'Cycle name is required' })}
        error={errors.title}
        placeholder="eg; 2026 Annual Review"
      />

      {/* Description */}
      <FormField
        label="Description"
        registration={register('description')}
        error={errors.description}
        placeholder="Optional description"
      />

      {/* Frequency */}
      <Controller
        name="frequency"
        control={control}
        render={({ field }) => (
          <SearchSelect
            label="Frequency"
            placeholder="Select frequency"
            options={FREQUENCY_OPTIONS}
            value={field.value}
            onChange={field.onChange}
            error={errors.frequency?.message}
          />
        )}
      />

      {/* Start + End Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Controller
          name="startDate"
          control={control}
          rules={{ required: 'Start date is required' }}
          render={({ field }) => (
            <DatePicker
              label="Start Date"
              value={field.value}
              onChange={field.onChange}
              error={errors.startDate?.message}
              disablePast
            />
          )}
        />
        <Controller
          name="endDate"
          control={control}
          rules={{
            required: 'End date is required',
            validate: (v) => !startDate || v >= startDate || 'Cannot be before start date',
          }}
          render={({ field }) => (
            <DatePicker
              label="End Date"
              value={field.value}
              onChange={field.onChange}
              error={errors.endDate?.message}
              disablePast
            />
          )}
        />
      </div>

      {/* Self-assessment + Manager review deadline */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Controller
          name="selfAssessmentDeadline"
          control={control}
          render={({ field }) => (
            <DatePicker
              label="Self Assessment Deadline"
              value={field.value}
              onChange={field.onChange}
              error={errors.selfAssessmentDeadline?.message}
              disablePast
            />
          )}
        />
        <Controller
          name="managerReviewDeadline"
          control={control}
          render={({ field }) => (
            <DatePicker
              label="Manager Review Deadline"
              value={field.value}
              onChange={field.onChange}
              error={errors.managerReviewDeadline?.message}
              disablePast
            />
          )}
        />
      </div>

      {/* Template */}
      <Controller
        name="templateId"
        control={control}
        render={({ field }) => (
          <SearchSelect
            label="Appraisal Template"
            placeholder="Select template"
            options={templateOptions}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />

      {/* Applies To — departments */}
      <Controller
        name="departmentIds"
        control={control}
        render={({ field }) => (
          <MultiSelect
            label="Departments"
            placeholder="All departments"
            options={deptOptions}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />

      {/* Applies To — employment types */}
      <Controller
        name="employmentTypes"
        control={control}
        render={({ field }) => (
          <EmploymentTypeSelect value={field.value} onChange={field.onChange} />
        )}
      />

      {/* Applies To — permission sets */}
      <Controller
        name="permissionSetIds"
        control={control}
        render={({ field }) => (
          <MultiSelect
            label="Roles"
            placeholder="All roles"
            options={permSetOptions}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />

      <div className="rounded-card border border-gray-200 bg-gray-50 p-4 space-y-3">
        <Controller
          name="useCompanyDefaultEligibility"
          control={control}
          render={({ field }) => (
            <button
              type="button"
              onClick={() => field.onChange(!field.value)}
              className="flex items-start gap-3 text-left"
            >
              <span
                className={cn(
                  'mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0',
                  field.value ? 'bg-brand border-brand' : 'border-gray-300 bg-white',
                )}
              >
                {field.value && <Icons.Check className="w-2.5 h-2.5 text-white" />}
              </span>
              <span className="space-y-1">
                <span className="block text-sm font-medium text-gray-900">
                  Use company default employment status policy
                </span>
                <span className="block text-xs text-gray-500">
                  Default eligible statuses:{' '}
                  {appraisalSettings?.appraisalEligibleStatuses?.length
                    ? appraisalSettings.appraisalEligibleStatuses
                        .map(
                          (status) =>
                            EMPLOYMENT_STATUS_OPTIONS.find((option) => option.value === status)
                              ?.label ?? status,
                        )
                        .join(', ')
                    : 'Active, Probation'}
                </span>
              </span>
            </button>
          )}
        />

        {!useCompanyDefaultEligibility && (
          <Controller
            name="employmentStatuses"
            control={control}
            render={({ field }) => (
              <EmploymentStatusSelect value={field.value} onChange={field.onChange} />
            )}
          />
        )}
      </div>

      {/* Specific employees toggle */}
      <div className="rounded-card border border-gray-200 bg-gray-50 p-4 space-y-3">
        <Controller
          name="selectSpecificEmployees"
          control={control}
          render={({ field }) => (
            <button
              type="button"
              onClick={() => {
                if (field.value) {
                  // clear selections when toggling off
                  field.onChange(false);
                } else {
                  field.onChange(true);
                }
              }}
              className="flex items-start gap-3 text-left w-full"
            >
              <span
                className={cn(
                  'mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0',
                  field.value ? 'bg-brand border-brand' : 'border-gray-300 bg-white',
                )}
              >
                {field.value && <Icons.Check className="w-2.5 h-2.5 text-white" />}
              </span>
              <span className="space-y-1">
                <span className="block text-sm font-medium text-gray-900">
                  Select specific employees
                </span>
                <span className="block text-xs text-gray-500">
                  Limit this cycle to individual employees.
                  {watchedDepartmentIds.length > 0 ||
                  (!useCompanyDefaultEligibility && watchedEmploymentStatuses.length > 0)
                    ? ' Only employees matching the selected departments and statuses above will appear.'
                    : ''}
                </span>
              </span>
            </button>
          )}
        />

        {selectSpecificEmployees && (
          <Controller
            name="employeeIds"
            control={control}
            render={({ field }) => (
              <EmployeeSelect
                value={field.value}
                onChange={field.onChange}
                departmentIds={watchedDepartmentIds}
                employmentStatuses={useCompanyDefaultEligibility ? [] : watchedEmploymentStatuses}
              />
            )}
          />
        )}
      </div>
    </SidePanel>
  );
}
