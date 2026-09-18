'use client';

import { Paperclip, RefreshCw, Search, Star } from 'lucide-react';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { cardClass, cn, inputClass } from '@/lib/utils';
import { EmailThread } from '@/types/reinsurance';

export type MailFolder = 'inbox' | 'outbox' | 'starred';

interface EmailThreadListProps {
  folder: MailFolder;
  onFolderChange: (folder: MailFolder) => void;
  inboxUnreadCount: number;
  threads: EmailThread[];
  isLoading: boolean;
  neverSynced: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  starredIds: Set<string>;
  onToggleStar: (id: string) => void;
}

function formatRelative(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (isYesterday) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function isUnread(thread: EmailThread): boolean {
  return thread.messages.some((m) => !m.isRead);
}

function threadPreview(thread: EmailThread): string {
  return thread.messages[0]?.bodyPreview ?? '';
}

function threadDisplayName(thread: EmailThread, folder: MailFolder): string {
  if (folder === 'outbox') {
    const recipients = thread.participants?.to ?? [];
    if (recipients.length === 0) return 'No recipients';
    const first = recipients[0].name ?? recipients[0].email ?? 'Unknown';
    return recipients.length > 1 ? `${first} +${recipients.length - 1} more` : first;
  }
  const from = thread.participants?.from;
  return from?.name ?? from?.email ?? 'Unknown sender';
}

export function EmailThreadList({
  folder,
  onFolderChange,
  inboxUnreadCount,
  threads,
  isLoading,
  neverSynced,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  starredIds,
  onToggleStar,
}: EmailThreadListProps) {
  return (
    <div className={cardClass('w-full sm:w-80 shrink-0 flex flex-col min-h-0 overflow-hidden')}>
      <TabBar
        className="px-2"
        activeTab={folder}
        onTabChange={(key) => onFolderChange(key as MailFolder)}
        tabs={[
          { key: 'inbox', label: 'Inbox', count: inboxUnreadCount },
          { key: 'outbox', label: 'Outbox' },
          { key: 'starred', label: 'Starred' },
        ]}
      />
      <div className="p-3 shrink-0">
        <div className="relative">
          <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search mail"
            className={inputClass(undefined, 'pl-8')}
          />
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-8 text-gray-400 gap-2 text-sm">
            <RefreshCw size={14} className="animate-spin" />
            Loading…
          </div>
        )}

        {!isLoading &&
          threads.map((thread) => {
            const unread = isUnread(thread);
            const starred = starredIds.has(thread.id);
            return (
              <button
                key={thread.id}
                type="button"
                onClick={() => onSelect(thread.id)}
                className={cn(
                  'w-full text-left px-3 py-3 border-b border-(--glass-border,rgba(255,255,255,0.4)) transition-colors',
                  thread.id === selectedId
                    ? 'bg-(--surface-hover,var(--color-gray-100))'
                    : 'hover:bg-(--surface-hover,var(--color-gray-100))/60',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={cn(
                      'text-sm truncate',
                      unread ? 'font-bold text-gray-900' : 'font-medium text-gray-700',
                    )}
                  >
                    {threadDisplayName(thread, folder)}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {formatRelative(thread.lastMessageAt)}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  {unread && <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />}
                  <p
                    className={cn(
                      'text-sm truncate',
                      unread ? 'font-semibold text-gray-900' : 'text-gray-600',
                    )}
                  >
                    {thread.subject ?? '(No subject)'}
                  </p>
                </div>
                <p className="text-xs text-gray-400 truncate mt-0.5">{threadPreview(thread)}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleStar(thread.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        onToggleStar(thread.id);
                      }
                    }}
                    className="text-gray-300 hover:text-amber-400 transition-colors"
                  >
                    <Star
                      size={12}
                      className={starred ? 'text-amber-400 fill-amber-400' : undefined}
                    />
                  </span>
                  {thread.hasAttachments && <Paperclip size={12} className="text-gray-400" />}
                </div>
              </button>
            );
          })}

        {!isLoading && threads.length === 0 && neverSynced && folder === 'inbox' && (
          <p className="text-sm text-gray-400 text-center py-8 px-4">
            No emails synced yet. Click &quot;Sync now&quot; to pull in your recent mail.
          </p>
        )}
        {!isLoading && threads.length === 0 && (!neverSynced || folder !== 'inbox') && (
          <p className="text-sm text-gray-400 text-center py-8">No emails to show here.</p>
        )}
      </div>
    </div>
  );
}
