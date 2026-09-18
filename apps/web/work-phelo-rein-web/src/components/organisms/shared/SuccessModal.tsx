'use client';

import { CheckmarkAnimation } from '@/components/atoms/CheckmarkAnimation';
import { useEffect } from 'react';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  actionLabel?: string;
}

export function SuccessModal({
  isOpen,
  onClose,
  title,
  message,
  actionLabel = 'Done',
}: SuccessModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-sm bg-white rounded-card shadow-2xl p-8 flex flex-col items-center text-center gap-5">
        {/* Success icon */}
        <CheckmarkAnimation size={72} />

        {/* Text */}
        <div className="flex flex-col gap-1.5">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          {message && <p className="text-sm text-gray-500 leading-relaxed">{message}</p>}
        </div>

        {/* Action */}
        <button
          onClick={onClose}
          className="w-full py-2.5 bg-brand text-white text-sm font-semibold rounded-input hover:bg-brand-hover transition-colors"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
