interface DetailFieldProps {
  label: string;
  value?: string | number | null;
  isCurrency?: boolean;
  className?: string;
}

export function DetailField({
  label,
  value,
  isCurrency = false,
  className = '',
}: DetailFieldProps) {
  const formattedValue =
    isCurrency && typeof value === 'number' ? `GHS ${value.toLocaleString()}` : value;

  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <span className="text-xs text-gray-400 font-medium tracking-wider">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{formattedValue ?? '—'}</span>
    </div>
  );
}
