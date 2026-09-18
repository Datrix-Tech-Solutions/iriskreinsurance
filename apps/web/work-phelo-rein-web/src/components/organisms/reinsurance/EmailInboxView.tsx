'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Unlink } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import {
  EmailThreadList,
  MailFolder,
} from '@/components/molecules/reinsurance/email/EmailThreadList';
import { EmailMessagePreview } from '@/components/molecules/reinsurance/email/EmailMessagePreview';
import { useEmailThreads, useSyncMailbox } from '@/hooks';
import { EmailThread, MailboxConnection } from '@/types/reinsurance';

interface EmailInboxViewProps {
  mailbox: MailboxConnection;
  onDisconnect?: () => void;
  disconnectLoading?: boolean;
}

function isUnread(thread: EmailThread): boolean {
  return thread.messages.some((m) => !m.isRead);
}

function isOutbound(thread: EmailThread): boolean {
  return thread.messages.some((m) => m.direction === 'OUTBOUND');
}

function formatSyncedAt(iso: string | null): string {
  if (!iso) return 'Never synced';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'Synced just now';
  if (minutes < 60) return `Synced ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Synced ${hours}h ago`;
  return `Synced ${Math.round(hours / 24)}d ago`;
}

export function EmailInboxView({ mailbox, onDisconnect, disconnectLoading }: EmailInboxViewProps) {
  const [folder, setFolder] = useState<MailFolder>('inbox');
  const [selectedId, setSelectedId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const { data, isLoading } = useEmailThreads({
    mailboxConnectionId: mailbox.id,
    search: debouncedSearch || undefined,
  });
  const syncMailbox = useSyncMailbox();

  const autoSyncTriggered = useRef(false);
  useEffect(() => {
    if (autoSyncTriggered.current) return;
    if (mailbox.status === 'ACTIVE' && !mailbox.lastSyncedAt) {
      autoSyncTriggered.current = true;
      syncMailbox.mutate({ id: mailbox.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mailbox.id, mailbox.status, mailbox.lastSyncedAt]);

  const allThreads = data?.items ?? [];

  function threadsForFolder(f: MailFolder): EmailThread[] {
    switch (f) {
      case 'inbox':
        return allThreads;
      case 'outbox':
        return allThreads.filter(isOutbound);
      case 'starred':
        return allThreads.filter((t) => starredIds.has(t.id));
    }
  }

  const threads = threadsForFolder(folder);
  const inboxUnreadCount = allThreads.filter(isUnread).length;

  const handleFolderChange = (nextFolder: MailFolder) => {
    setFolder(nextFolder);
    setSelectedId(threadsForFolder(nextFolder)[0]?.id ?? '');
  };

  const toggleStar = (id: string) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedThread = allThreads.find((t) => t.id === selectedId);

  return (
    <div className="flex flex-col h-full min-h-0 p-4 gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-gray-900 truncate">
            {mailbox.emailAddress}
          </span>
          <span className="text-xs text-gray-400 shrink-0">
            {formatSyncedAt(mailbox.lastSyncedAt)}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw size={16} />}
            isLoading={syncMailbox.isPending}
            loadingText="Syncing..."
            onClick={() => syncMailbox.mutate({ id: mailbox.id })}
          >
            Sync now
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<Unlink size={16} />}
            isLoading={disconnectLoading}
            loadingText="Disconnecting..."
            onClick={onDisconnect}
          >
            Disconnect
          </Button>
        </div>
      </div>

      {/* Two-pane inbox */}
      <div className="flex flex-1 min-h-0 gap-3">
        <EmailThreadList
          folder={folder}
          onFolderChange={handleFolderChange}
          inboxUnreadCount={inboxUnreadCount}
          threads={threads}
          isLoading={isLoading}
          neverSynced={!mailbox.lastSyncedAt}
          selectedId={selectedId}
          onSelect={setSelectedId}
          search={search}
          onSearchChange={setSearch}
          starredIds={starredIds}
          onToggleStar={toggleStar}
        />
        <EmailMessagePreview thread={selectedThread} onBack={() => setSelectedId('')} />
      </div>
    </div>
  );
}
