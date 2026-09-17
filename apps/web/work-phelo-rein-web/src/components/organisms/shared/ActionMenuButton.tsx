'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/atoms/Button';

export interface ActionMenuItem {
  label: string;
  description?: string;
  onClick: () => void;
}

interface ActionMenuButtonProps {
  label: string;
  items: ActionMenuItem[];
  size?: 'sm' | 'md' | 'lg';
}

export function ActionMenuButton({ label, items, size = 'sm' }: ActionMenuButtonProps) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, bottom: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleToggle = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setOpenUpward(window.innerHeight - rect.bottom < 220);
      setMenuPos({
        top: rect.bottom + 4,
        bottom: window.innerHeight - rect.top + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen((v) => !v);
  };

  return (
    <>
      <Button ref={buttonRef} type="button" size={size} onClick={handleToggle}>
        {label}
        <ChevronDown className={cn('w-4 h-4 ml-1.5 transition-transform', open && 'rotate-180')} />
      </Button>

      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
              style={{
                position: 'fixed',
                right: menuPos.right,
                ...(openUpward ? { bottom: menuPos.bottom } : { top: menuPos.top }),
                minWidth: 240,
              }}
              className="z-50 bg-white border border-gray-100 rounded-input shadow-lg py-1 overflow-hidden"
            >
              {items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    item.onClick();
                    setOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors"
                >
                  <span className="block text-sm font-medium text-gray-900">{item.label}</span>
                  {item.description && (
                    <span className="block text-xs text-gray-400 mt-0.5">{item.description}</span>
                  )}
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
