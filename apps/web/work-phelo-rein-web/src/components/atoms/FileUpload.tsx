'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { Paperclip, X } from 'lucide-react';

interface FileUploadProps {
  label?: string;
  accept?: string;
  value?: File | null;
  onChange: (file: File | null) => void;
  error?: string;
  hint?: string;
}

export function FileUpload({ label, accept, value, onChange, error, hint }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
      {label && <span className="text-sm font-medium text-gray-700">{label}</span>}

      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed cursor-pointer transition-colors bg-gray-50 hover:bg-gray-100',
          error ? 'border-red-400' : 'border-gray-300',
        )}
        onClick={() => inputRef.current?.click()}
      >
        <Paperclip className="w-4 h-4 text-gray-400 shrink-0" />

        {value ? (
          <span className="flex-1 text-sm text-gray-700 truncate">{value.name}</span>
        ) : (
          <span className="flex-1 text-sm text-gray-400">Click to upload a file</span>
        )}

        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
            className="shrink-0 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />

      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
