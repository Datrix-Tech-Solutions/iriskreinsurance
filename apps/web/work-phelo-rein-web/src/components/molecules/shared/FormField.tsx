import { Input } from '@/components/atoms/Input';
import { PasswordInput } from '@/components/atoms/PasswordInput';
import { FieldError, UseFormRegisterReturn } from 'react-hook-form';

interface FormFieldProps {
  label: string;
  registration: UseFormRegisterReturn;
  error?: FieldError;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
  rows?: number;
  step?: string | number;
  /** Rendered inside the input's own box, overlaid on the right edge. */
  rightElement?: React.ReactNode;
}

export function FormField({
  label,
  registration,
  error,
  type = 'text',
  placeholder,
  readOnly,
  rows,
  step,
  rightElement,
}: FormFieldProps) {
  if (type === 'password') {
    return (
      <PasswordInput
        label={label}
        placeholder={placeholder}
        readOnly={readOnly}
        error={error?.message}
        {...registration}
      />
    );
  }

  if (type === 'email') {
    const { onChange, ...rest } = registration;
    return (
      <Input
        label={label}
        type="email"
        placeholder={placeholder}
        readOnly={readOnly}
        error={error?.message}
        onChange={(e) => {
          e.target.value = e.target.value.toLowerCase();
          onChange(e);
        }}
        {...rest}
      />
    );
  }

  return (
    <Input
      label={label}
      type={type as 'textarea'}
      placeholder={placeholder}
      readOnly={readOnly}
      error={error?.message}
      rows={rows}
      step={step}
      rightElement={rightElement}
      {...registration}
    />
  );
}
