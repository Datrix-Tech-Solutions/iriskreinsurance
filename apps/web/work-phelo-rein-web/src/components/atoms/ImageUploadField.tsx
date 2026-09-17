'use client';

/* eslint-disable @next/next/no-img-element */

import { useRef } from 'react';
import { Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/atoms/Button';

interface ImageUploadFieldProps {
  label?: string;
  hint?: string;
  /** Current image as a data URL, or null. */
  value: string | null;
  onChange: (dataUrl: string) => void;
  onClear: () => void;
  /** `accept` attribute for the file input. */
  accept?: string;
  /** MIME types allowed through; a file outside the set is rejected. */
  allowedTypes?: string[];
  maxBytes?: number;
  onError?: (message: string) => void;
}

const DEFAULT_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml';

/** Thumbnail + upload/replace/remove control that emits the picked image as a data URL. */
export function ImageUploadField({
  label,
  hint,
  value,
  onChange,
  onClear,
  accept = DEFAULT_ACCEPT,
  allowedTypes,
  maxBytes,
  onError,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (allowedTypes && !allowedTypes.includes(file.type)) {
      onError?.('Unsupported image type.');
      return;
    }
    if (maxBytes && file.size > maxBytes) {
      onError?.(`Image must be ${Math.round(maxBytes / 1024 / 1024)} MB or smaller.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-sm font-bold text-gray-900">{label}</span>}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-14 w-24 items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-white">
          {value ? (
            <img src={value} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <ImageIcon className="h-4 w-4 text-gray-400" />
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={<Upload className="h-3.5 w-3.5" />}
          onClick={() => inputRef.current?.click()}
        >
          {value ? 'Replace' : 'Upload'}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={<Trash2 className="h-3.5 w-3.5" />}
            onClick={onClear}
          >
            Remove
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(event) => {
            handleFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
