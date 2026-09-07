'use client';

import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleCardProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** A plain white card whose body collapses behind its header. */
export function CollapsibleCard({ title, defaultOpen = false, children }: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left"
      >
        <span>
          <span className="block text-sm font-semibold text-gray-900">{title}</span>
        </span>
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 text-gray-400 transition-transform ${
            open ? '' : '-rotate-90'
          }`}
        />
      </button>
      {open && (
        <div id={bodyId} className="px-5 pb-5">
          {children}
        </div>
      )}
    </div>
  );
}
