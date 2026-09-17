'use client';

import { useState, useSyncExternalStore } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/store/toast.store';

const SESSION_KEY = 'mood_selector_shown';

function subscribe() {
  return () => {};
}

function getSnapshot() {
  return sessionStorage.getItem(SESSION_KEY) === null;
}

function getServerSnapshot() {
  return false;
}

const MOODS = [
  {
    emoji: '😞',
    label: 'Very Sad',
    animationClass: 'mood-very-sad',
    baseClass: 'bg-transparent hover:bg-red-200',
    selectedClass: 'bg-red-100 ring-2 ring-red-200',
  },
  {
    emoji: '🙁',
    label: 'Sad',
    animationClass: 'mood-sad',
    baseClass: 'bg-transparent hover:bg-orange-200',
    selectedClass: 'bg-orange-100 ring-2 ring-orange-200',
  },
  {
    emoji: '😐',
    label: 'Neutral',
    animationClass: 'mood-neutral',
    baseClass: 'bg-transparent hover:bg-gray-200',
    selectedClass: 'bg-gray-100 ring-2 ring-gray-200',
  },
  {
    emoji: '🙂',
    label: 'Happy',
    animationClass: 'mood-happy',
    baseClass: 'bg-transparent hover:bg-lime-200',
    selectedClass: 'bg-lime-100 ring-2 ring-lime-200',
  },
  {
    emoji: '😄',
    label: 'Very Happy',
    animationClass: 'mood-very-happy',
    baseClass: 'bg-transparent hover:bg-yellow-200',
    selectedClass: 'bg-yellow-100 ring-2 ring-yellow-200',
  },
];

export function MoodSelectorModal() {
  // false on the server and the first client render (hydration-safe); React resyncs to
  // the real sessionStorage value right after hydration completes.
  const notShownYet = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [closed, setClosed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const open = notShownYet && !closed;

  const close = () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    setClosed(true);
  };

  const selectMood = (label: string) => {
    setSelected(label);
    useToastStore
      .getState()
      .addToast({ message: 'Thanks for sharing how you feel!', type: 'success' });
    setTimeout(close, 300);
  };

  return (
    <Modal
      isOpen={open}
      onClose={close}
      title="How are you feeling today?"
      width="w-[95vw] max-w-2xl"
    >
      <div className="grid grid-cols-5 gap-1 mt-2 -mx-6 sm:mx-0">
        {MOODS.map(({ emoji, label, animationClass, baseClass, selectedClass }) => (
          <button
            key={label}
            type="button"
            onClick={() => selectMood(label)}
            className={cn(
              'flex min-h-32 min-w-0 flex-col items-center justify-center gap-1.5 rounded-lg p-3 text-center transition-colors',
              selected === label ? selectedClass : baseClass,
            )}
          >
            <span className={cn('inline-block text-5xl sm:text-6xl', animationClass)}>{emoji}</span>
            <span className="text-xs font-medium text-gray-900">{label}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
