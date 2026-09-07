'use client';

import { Archive, ChevronLeft, Paperclip, Reply } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { cardClass } from '@/lib/utils';
import { EmailThread } from '@/types/reinsurance';

interface EmailMessagePreviewProps {
  thread: EmailThread | undefined;
  onBack: () => void;
}

export function EmailMessagePreview({ thread, onBack }: EmailMessagePreviewProps) {
  if (!thread) {
    return (
      <div
        className={cardClass(
          'hidden sm:flex flex-1 min-h-0 items-center justify-center text-sm text-gray-400',
        )}
      >
        Select an email to preview it here.
      </div>
    );
  }

  return (
    <div className={cardClass('hidden sm:flex flex-1 min-h-0 flex-col overflow-hidden')}>
      <div className="p-4 border-b border-(--glass-border,rgba(255,255,255,0.55)) flex items-center justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <h3 className="font-bold text-gray-900 truncate">{thread.subject ?? '(No subject)'}</h3>
          {thread.messageCount > 5 && (
            <p className="text-xs text-gray-400">Showing 5 most recent messages</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" icon={<Reply size={16} />} disabled>
            Reply
          </Button>
          <Button variant="ghost" size="sm" icon={<Archive size={16} />} disabled>
            Archive
          </Button>
          <button type="button" className="sm:hidden text-gray-400" onClick={onBack}>
            <ChevronLeft size={18} />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4">
        {thread.messages.map((message) => (
          <div key={message.id} className={cardClass('p-4')}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {message.fromName ?? message.fromEmail ?? 'Unknown sender'}
                </p>
                <p className="text-xs text-gray-400">{message.fromEmail}</p>
              </div>
              <span className="text-xs text-gray-400 shrink-0">
                {(message.receivedAt ?? message.sentAt) &&
                  new Date(message.receivedAt ?? message.sentAt ?? '').toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
              </span>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-line mt-3">
              {message.bodyText ?? message.bodyPreview ?? ''}
            </p>
            {message.hasAttachments && (
              <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-500">
                <Paperclip size={12} />
                <span>
                  {message.attachments.length || 1} attachment
                  {message.attachments.length === 1 ? '' : 's'}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
