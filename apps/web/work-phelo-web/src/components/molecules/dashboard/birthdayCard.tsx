'use client';

import Image from 'next/image';
import { ChevronLeft, ChevronRight, PartyPopper } from 'lucide-react';
import { cardClass, frostedAvatarStyle } from '@/lib/utils';

interface Birthday {
  id: string;
  name: string;
  date: string;
  initials: string;
  color: string;
  avatarUrl?: string;
}

interface BirthdaysCardProps {
  birthdays: Birthday[];
  scrollRef?: React.RefObject<HTMLDivElement | null> | null;
  onScrollLeft: () => void;
  onScrollRight: () => void;
}

export function BirthdaysCard({
  birthdays,
  scrollRef,
  onScrollLeft,
  onScrollRight,
}: BirthdaysCardProps) {
  return (
    <div className={cardClass('p-5 flex flex-col shrink-0 border-gray-200')}>
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-base font-bold text-gray-900">Upcoming Birthdays</h2>
        {birthdays.length > 0 && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={onScrollLeft}
              className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-400" />
            </button>
            <button
              onClick={onScrollRight}
              className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-gray-10 -mx-5 mt-0 mb-5 shrink-0" />

      {/* Content */}
      {birthdays.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            <PartyPopper className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm text-gray-400 mt-2">No upcoming birthdays</p>
        </div>
      ) : (
        <div
          ref={scrollRef ?? null}
          className="flex gap-6 overflow-x-auto pb-3 scrollbar-hide"
          style={{ scrollbarWidth: 'none' }}
        >
          {birthdays.map((person) => (
            <div key={person.id} className="flex flex-col items-center gap-3 shrink-0 w-24">
              {person.avatarUrl ? (
                <Image
                  src={person.avatarUrl}
                  alt={person.initials}
                  width={64}
                  height={64}
                  className="w-16 h-16 rounded-full object-cover shrink-0"
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-white text-lg font-bold shrink-0"
                  style={frostedAvatarStyle(person.color)}
                >
                  {person.initials}
                </div>
              )}
              <div className="text-center w-full">
                <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2 wrap-break-word">
                  {person.name}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{person.date}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
