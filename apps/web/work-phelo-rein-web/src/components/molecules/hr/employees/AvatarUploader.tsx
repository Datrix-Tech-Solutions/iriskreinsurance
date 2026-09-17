'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Trash2, UploadCloud } from 'lucide-react';
import { Avatar } from '@/components/atoms/Avatar';
import { cn } from '@/lib/utils';

export const AVATAR_ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const AVATAR_HINT = 'JPG, PNG or WebP · up to 5 MB';

interface AvatarUploaderProps {
  /** Name used for the initials fallback in the preview. */
  name: string;
  /** Existing avatar URL, shown until a new file is picked or it's removed. */
  currentUrl?: string | null;
  /** Currently selected file (controlled). */
  file: File | null;
  onFileChange: (file: File | null) => void;
  /** True once the user has chosen to clear the existing photo. */
  markedForRemoval?: boolean;
  /** Called when the user clicks "Remove photo". */
  onRemove?: () => void;
  disabled?: boolean;
}

/**
 * Profile-photo picker: large preview + drag/click to choose, with client-side
 * type/size validation. Emits the raw `File` (upload is wired separately).
 */
export function AvatarUploader({
  name,
  currentUrl,
  file,
  onFileChange,
  markedForRemoval = false,
  onRemove,
  disabled = false,
}: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const accept = (picked: File | undefined) => {
    if (!picked) return;
    if (!AVATAR_ACCEPT.includes(picked.type)) {
      setError('Unsupported format. Use a JPG, PNG or WebP image.');
      return;
    }
    if (picked.size > AVATAR_MAX_BYTES) {
      setError('That image is over 5 MB. Pick a smaller one.');
      return;
    }
    setError(null);
    onFileChange(picked);
  };

  const shownUrl = previewUrl ?? (markedForRemoval ? null : (currentUrl ?? null));
  const hasSomethingToClear = Boolean(file) || (Boolean(currentUrl) && !markedForRemoval);

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) accept(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          'relative flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-6 transition-colors',
          dragging ? 'border-brand bg-brand/5' : 'border-gray-300 bg-gray-50',
          disabled && 'opacity-60',
        )}
      >
        <Avatar name={name} avatarUrl={shownUrl} size={112} shape="rounded" />

        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-input border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed"
        >
          {shownUrl ? <ImagePlus className="h-4 w-4" /> : <UploadCloud className="h-4 w-4" />}
          {shownUrl ? 'Replace photo' : 'Upload photo'}
        </button>

        <p className="text-xs text-gray-400">
          Drag an image here, or <span className="text-gray-500">browse</span>. {AVATAR_HINT}
        </p>

        <input
          ref={inputRef}
          type="file"
          accept={AVATAR_ACCEPT.join(',')}
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            accept(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      {error && <p className="text-xs font-medium text-red-600">{error}</p>}

      {hasSomethingToClear && onRemove && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setError(null);
            onFileChange(null);
            onRemove();
          }}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 transition-colors hover:text-red-700 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Remove photo
        </button>
      )}
    </div>
  );
}
