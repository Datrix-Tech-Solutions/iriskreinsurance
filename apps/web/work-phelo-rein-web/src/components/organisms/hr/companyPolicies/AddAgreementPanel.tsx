'use client';

import { useCallback, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { inputClass } from '@/lib/utils';
import type { CompanyAgreement, CompanyAgreementType, CreateCompanyAgreementDto } from '@/types/hr';

const AGREEMENT_TYPE_OPTIONS = [
  { value: 'NDA', label: 'Non-Disclosure Agreement (NDA)' },
  { value: 'EMPLOYMENT_CONTRACT', label: 'Employment Contract' },
  { value: 'CONFIDENTIALITY', label: 'Confidentiality Agreement' },
  { value: 'NON_COMPETE', label: 'Non-Compete Agreement' },
  { value: 'CODE_OF_CONDUCT', label: 'Code of Conduct' },
  { value: 'IP_ASSIGNMENT', label: 'IP Assignment Agreement' },
  { value: 'PROBATION_AGREEMENT', label: 'Probation Agreement' },
  { value: 'OTHER', label: 'Other' },
];

interface FormValues {
  type: CompanyAgreementType;
  title: string;
  details: string;
}

interface AddAgreementPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateCompanyAgreementDto) => void;
  isSubmitting?: boolean;
  agreement?: Pick<CompanyAgreement, 'id' | 'type' | 'title' | 'details'> | null;
}

export function AddAgreementPanel({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  agreement,
}: AddAgreementPanelProps) {
  const isEdit = !!agreement;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>();

  useEffect(() => {
    if (isOpen && agreement) {
      reset({ type: agreement.type, title: agreement.title, details: agreement.details });
    }
  }, [isOpen, agreement, reset]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title={isEdit ? 'Edit Agreement' : 'Add Agreement'}
      description={
        isEdit
          ? 'Update the details of this agreement.'
          : 'Define a company agreement that employees will be required to sign.'
      }
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            isLoading={isSubmitting}
            loadingText={isEdit ? 'Saving…' : 'Creating…'}
            onClick={handleSubmit(onSubmit)}
          >
            {isEdit ? 'Save Changes' : 'Create'}
          </Button>
        </div>
      }
    >
      <Controller
        name="type"
        control={control}
        rules={{ required: 'Agreement type is required' }}
        render={({ field }) => (
          <SearchSelect
            label="Agreement Type"
            placeholder="Select agreement type"
            options={AGREEMENT_TYPE_OPTIONS}
            value={field.value}
            onChange={field.onChange}
            error={errors.type?.message}
          />
        )}
      />

      <FormField
        label="Document Title"
        registration={register('title', { required: 'Title is required' })}
        error={errors.title}
        placeholder="e.g. Employee Non-Disclosure Agreement 2025"
      />

      <div className="flex flex-col gap-(--field-label-gap,0.125rem) flex-1 min-h-0">
        <label className="text-sm font-bold text-gray-900">Agreement Details</label>
        <textarea
          {...register('details', { required: 'Details are required' })}
          placeholder="Enter the full text or a summary of the agreement terms…"
          className={inputClass(errors.details?.message, 'resize-none flex-1 h-full')}
        />
        {errors.details && <p className="text-xs text-red-500">{errors.details.message}</p>}
      </div>
    </SidePanel>
  );
}
