'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cardClass, cn, popupClass } from '@/lib/utils';
import { Icons } from '@/components/atoms/icons';

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
  /** Translucent glass surface with the page behind the backdrop blurred, instead of the
   * default near-solid popup surface with a plain dimming overlay. Opt-in — leaves every
   * other SidePanel consumer unchanged. */
  glass?: boolean;
  /** Rendered at the end of the description line (only shown alongside a description). */
  descriptionAction?: React.ReactNode;
}

export function SidePanel({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'sm:w-[480px]',
  glass = false,
  descriptionAction,
}: SidePanelProps) {
  // Portals need a browser DOM to render into — stay unmounted through SSR and the
  // initial client render so hydration sees the same (empty) output, then flip on.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 transition-opacity duration-300',
          glass ? 'bg-black/20' : 'bg-black/60',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      />

      {/* Floating Side Panel */}
      <div
        className={cn(
          (glass ? cardClass : popupClass)(
            cn(
              'fixed z-50 flex flex-col shadow-2xl overflow-hidden',
              'transition-all duration-300 ease-out',
              // Mobile: full screen, no rounding
              'inset-0 rounded-none',
              // sm+: floating panel
              'sm:inset-auto sm:top-6 sm:bottom-6 sm:right-6 sm:rounded-3xl',
            ),
          ),
          width,
          // Animation: slide in from right with slight scale
          isOpen
            ? 'translate-x-0 scale-100 opacity-100'
            : 'translate-x-12 scale-95 opacity-0 pointer-events-none',
        )}
      >
        {/* Header */}
        <div className="shrink-0 px-3 sm:px-6 py-1 sm:py-2 border-b border-(--glass-border,rgba(255,255,255,0.55))">
          <div className="flex items-start justify-between gap-1">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-xl font-semibold text-gray-900 tracking-tight">
                {title}
              </h2>
              {description && (
                <div className="flex items-center justify-between gap-3 mt-1.5">
                  <p className="text-sm text-gray-500">{description}</p>
                  {descriptionAction}
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              className="text-gray-700 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-all"
              aria-label="Close panel"
            >
              <Icons.X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-2 sm:px-6 py-2 sm:py-3">
          <div className="flex flex-col gap-6 h-full">{children}</div>
        </div>

        {/* Footer — just a divider within the panel's own glass surface, not a second one */}
        {footer && (
          <div className="shrink-0 px-3 sm:px-6 py-2 sm:py-2 border-t border-(--glass-border,rgba(255,255,255,0.55))">
            {footer}
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}
