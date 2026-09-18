import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { FormField } from '@/components/molecules/shared/FormField';
import { inputClass } from '@/lib/utils';

export interface RoleFormValues {
  name: string;
  description: string;
}

interface RoleFormFieldsProps {
  register: UseFormRegister<RoleFormValues>;
  errors: FieldErrors<RoleFormValues>;
}

export function RoleFormFields({ register, errors }: RoleFormFieldsProps) {
  return (
    <>
      <FormField
        label="Role Name"
        registration={register('name', { required: 'Role name is required' })}
        error={errors.name}
        placeholder="e.g. Finance Officer"
      />

      <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
        <label className="text-sm font-bold text-gray-900">
          Description <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          {...register('description')}
          placeholder="Briefly describe what this role can do"
          rows={5}
          className={inputClass(undefined, 'resize-none')}
        />
      </div>
    </>
  );
}
