'use client';

import type { ReactNode } from 'react';
import { Toggle } from '@/components/atoms/Toggle';
import { SegmentedToggle } from '@/components/atoms/SegmentedToggle';
import { POSITION_OPTIONS, type SlotPosition } from './templateConfig';

interface LetterheadElementRowProps {
  label: string;
  show: boolean;
  onShowChange: (value: boolean) => void;
  position: SlotPosition;
  onPositionChange: (value: SlotPosition) => void;
  children?: ReactNode;
}

export function LetterheadElementRow({
  label,
  show,
  onShowChange,
  position,
  onPositionChange,
  children,
}: LetterheadElementRowProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-gray-900">{label}</span>
        <Toggle enabled={show} onChange={onShowChange} />
      </div>
      <div className={show ? '' : 'pointer-events-none opacity-40'}>
        <SegmentedToggle value={position} onChange={onPositionChange} options={POSITION_OPTIONS} />
      </div>
      {show && children ? <div className="flex flex-col gap-3">{children}</div> : null}
    </div>
  );
}
