'use client';

import { Toggle } from '@/components/atoms/Toggle';

interface ToggleRowProps {
  label: string;
  description?: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
}

export function ToggleRow({ label, description, enabled, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-gray-900">{label}</span>
        {description && <span className="text-xs text-gray-400">{description}</span>}
      </div>
      <Toggle enabled={enabled} onChange={onChange} />
    </div>
  );
}
