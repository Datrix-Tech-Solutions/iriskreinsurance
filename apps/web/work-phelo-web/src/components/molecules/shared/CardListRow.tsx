'use client';

import { Pencil, Trash2 } from 'lucide-react';

interface Props {
  label: string;
  sublabel?: string;
  onEdit: () => void;
  onDelete: () => void;
}

export function CardListRow({ label, sublabel, onEdit, onDelete }: Props) {
  return (
    <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{label}</p>
        {sublabel && <p className="text-xs text-gray-500 truncate">{sublabel}</p>}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-(--text-hover-strong,var(--color-gray-900)) transition-colors"
        >
          <Pencil className="w-4 h-4" />
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      </div>
    </div>
  );
}
