'use client';

import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { Employee, UpdateEmployeePayload, Gender, MaritalStatus } from '@/types/hr';
import { PhoneInput } from '@/components/atoms/PhoneInput';
import { isAtLeastMinimumEmployeeAge, MIN_EMPLOYEE_AGE } from '@/lib/employeeAge';

interface EditMyProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  onSave: (data: UpdateEmployeePayload) => void;
  isUpdating: boolean;
}

export function EditMyProfilePanel({
  isOpen,
  onClose,
  employee,
  onSave,
  isUpdating,
}: EditMyProfilePanelProps) {
  const form = useForm<UpdateEmployeePayload>();
  const { reset } = form;

  const dobValue = useWatch({ control: form.control, name: 'dateOfBirth' });
  const genderValue = useWatch({ control: form.control, name: 'gender' });
  const maritalValue = useWatch({ control: form.control, name: 'maritalStatus' });

  useEffect(() => {
    if (!employee) return;
    reset({
      firstName: employee.firstName,
      lastName: employee.lastName,
      phone: employee.phone ?? '',
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
      bankName: employee.bankName ?? '',
      bankAccountNumber: employee.bankAccountNumber ?? '',
      bankBranch: employee.bankBranch ?? '',
      ssnit: employee.ssnit ?? '',
      tinNumber: employee.tinNumber ?? '',
    });
  }, [employee, reset]);

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Profile"
      description={`${employee.firstName} ${employee.lastName}`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            isLoading={isUpdating}
            loadingText="Saving…"
            onClick={form.handleSubmit((data) => {
              if (data.dateOfBirth && !isAtLeastMinimumEmployeeAge(data.dateOfBirth)) {
                form.setError('dateOfBirth', {
                  type: 'validate',
                  message: `Employee must be at least ${MIN_EMPLOYEE_AGE} years old`,
                });
                return;
              }

              form.clearErrors('dateOfBirth');
              const dateFields = ['dateOfBirth'] as const;
              for (const field of dateFields) {
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
          registration={form.register('firstName', { required: 'Required' })}
          error={form.formState.errors.firstName}
          placeholder="eg; Kofi"
        />
        <FormField
          label="Last Name"
          registration={form.register('lastName', { required: 'Required' })}
          error={form.formState.errors.lastName}
          placeholder="eg; Boateng"
        />
        <Controller
          control={form.control}
          name="phone"
          render={({ field, fieldState }) => (
            <PhoneInput
              label="Phone"
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
              placeholder="30 000 0000"
            />
          )}
        />
        <DatePicker
          label="Date of Birth"
          value={dobValue}
          onChange={(v) => {
            form.setValue('dateOfBirth', v);
            form.clearErrors('dateOfBirth');
          }}
          error={form.formState.errors.dateOfBirth?.message}
          disableFuture
        />
        <SearchSelect
          label="Gender"
          placeholder="Select gender"
          value={genderValue}
          onChange={(v) => form.setValue('gender', v as Gender)}
          options={[
            { value: 'MALE', label: 'Male' },
            { value: 'FEMALE', label: 'Female' },
          ]}
        />
        <SearchSelect
          label="Marital Status"
          placeholder="Select status"
          value={maritalValue}
          onChange={(v) => form.setValue('maritalStatus', v as MaritalStatus)}
          options={[
            { value: 'SINGLE', label: 'Single' },
            { value: 'MARRIED', label: 'Married' },
            { value: 'DIVORCED', label: 'Divorced' },
            { value: 'WIDOWED', label: 'Widowed' },
          ]}
        />
        <FormField
          label="Nationality"
          registration={form.register('nationality')}
          placeholder="eg; Ghanaian"
        />
        <FormField
          label="National ID Number"
          registration={form.register('nationalId')}
          placeholder="eg; GHA-000000000-0"
        />
        <FormField
          label="Address"
          registration={form.register('address')}
          placeholder="eg; 12 Accra Road"
        />
        <FormField label="City" registration={form.register('city')} placeholder="eg; Accra" />
        <FormField
          label="Region"
          registration={form.register('region')}
          placeholder="eg; Greater Accra"
        />
      </div>

      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Emergency Contact
        </p>
        <FormField
          label="Full Name"
          registration={form.register('emergencyName')}
          placeholder="eg; Abena Boateng"
        />
        <Controller
          control={form.control}
          name="emergencyPhone"
          render={({ field, fieldState }) => (
            <PhoneInput
              label="Phone"
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
              placeholder="30 000 0000"
            />
          )}
        />

        <FormField
          label="Relationship"
          registration={form.register('emergencyRelation')}
          placeholder="eg; Spouse"
        />
      </div>

      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Banking & Compliance
        </p>
        <FormField
          label="Bank Name"
          registration={form.register('bankName')}
          placeholder="eg; GCB Bank"
        />
        <FormField
          label="Account Number"
          registration={form.register('bankAccountNumber')}
          placeholder="eg; 1234567890"
        />
        <FormField
          label="Bank Branch"
          registration={form.register('bankBranch')}
          placeholder="eg; Accra Main"
        />
        <FormField
          label="SSNIT Number"
          registration={form.register('ssnit')}
          placeholder="eg; P00123456"
        />
        <FormField
          label="TIN Number"
          registration={form.register('tinNumber')}
          placeholder="eg; P0012345678"
        />
      </div>
    </SidePanel>
  );
}
