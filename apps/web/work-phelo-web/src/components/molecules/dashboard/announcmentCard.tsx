'use client';

import { useState } from 'react';
import { Megaphone } from 'lucide-react';
import { Modal } from '@/components/organisms/shared/Modal';
import { cardClass } from '@/lib/utils';
import {
  useMarkAnnouncementRead,
  useMarkAllAnnouncementsRead,
  useAnnouncementsUnreadCount,
} from '@/hooks';

interface Announcement {
  id: string;
  title: string;
  body: string;
  date: string;
  isRead?: boolean;
}

interface AnnouncementCardProps {
  announcements: Announcement[];
}

export function AnnouncementCard({ announcements }: AnnouncementCardProps) {
  const [pendingReadIds, setPendingReadIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { mutate: markRead } = useMarkAnnouncementRead();
  const { mutate: markAllRead } = useMarkAllAnnouncementsRead();
  const { data: unreadData } = useAnnouncementsUnreadCount();

  const unreadCount =
    unreadData?.count ?? announcements.filter((a) => !a.isRead && !pendingReadIds.has(a.id)).length;
  const selected = announcements.find((a) => a.id === selectedId) ?? null;

  const handleSelect = (id: string) => {
    setPendingReadIds((prev) => new Set([...prev, id]));
    markRead(id);
    setSelectedId(id);
  };

  const handleMarkAllRead = () => {
    setPendingReadIds(new Set(announcements.map((a) => a.id)));
    markAllRead();
  };

  if (announcements.length === 0) {
    return (
      <div className={cardClass('p-5 flex flex-col gap-3 min-h-60 flex-1 border-gray-200')}>
        <div className="flex items-center gap-2 shrink-0">
          <h2 className="text-base font-bold text-gray-900">General Announcements</h2>
        </div>
        <div className="h-px bg-gray-100 -mx-5" />
        <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center py-8">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-sm text-gray-400">No announcements yet</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={cardClass('p-5 flex flex-col min-h-100 flex-1 border-gray-200')}>
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-900">General Announcements</h2>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-gray-400 hover:text-orange-500 transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-100 -mx-5 mt-4 shrink-0" />

        {/* List */}
        <div className="flex flex-col divide-y divide-gray-100 overflow-y-auto max-h-225">
          {announcements.map((a) => {
            const isRead = (a.isRead ?? false) || pendingReadIds.has(a.id);
            return (
              <button
                key={a.id}
                onClick={() => handleSelect(a.id)}
                className="flex items-start gap-3 py-3 text-left hover:bg-gray-50 -mx-5 px-5 transition-colors"
              >
                <span
                  className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${isRead ? 'invisible' : 'bg-orange-500'}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`text-sm leading-snug ${isRead ? 'font-normal text-gray-500' : 'font-extrabold text-gray-900'}`}
                    >
                      {a.title}
                    </p>
                    <span
                      className={`text-xs leading-snug ${isRead ? 'font-normal text-gray-400' : 'font-bold text-gray-800'} shrink-0 whitespace-nowrap mt-0.5`}
                    >
                      {a.date}
                    </span>
                  </div>
                  <p
                    className={`text-xs leading-snug ${isRead ? 'font-normal text-gray-500' : 'font-extrabold text-gray-900'} leading-relaxed line-clamp-2 mt-0.5`}
                  >
                    {a.body}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Modal
        isOpen={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected?.title ?? ''}
        width="max-w-lg"
      >
        {selected && (
          <div className="flex flex-col gap-3 pt-1">
            <p className="text-xs text-gray-400">{selected.date}</p>
            <div className="h-px bg-gray-100" />
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
              {selected.body}
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}
