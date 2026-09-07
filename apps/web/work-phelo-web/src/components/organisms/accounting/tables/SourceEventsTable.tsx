'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { TableButton } from '@/components/atoms/TableButton';
import { DataTable, type Column } from '@/components/organisms/shared/DataTable';
import { useProcessSourceEvent, useRetrySourceEvent, useSourceEvents } from '@/hooks';
import { usePermissionRule } from '@/hooks/hr/usePermission';
import { extractError } from '@/lib/extractError';
import { useToast } from '@/hooks/useToast';
import { getSourceEventLabel } from '@/config/reinsurance-event-catalog';
import { formatJournalNumber } from '@/lib/formatters';
import type { SourceEventInboxItem, SourceEventStatus } from '@/types/accounting';

const PAGE_SIZE = 10;

const STATUS_VARIANT: Record<
  SourceEventStatus,
  'success' | 'warning' | 'danger' | 'info' | 'neutral'
> = {
  RECEIVED: 'warning',
  PROCESSING: 'info',
  POSTED: 'success',
  FAILED: 'danger',
  IGNORED: 'neutral',
};

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SourceEventsTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data = [], isLoading, isError } = useSourceEvents();
  const processEvent = useProcessSourceEvent();
  const retryEvent = useRetrySourceEvent();
  const canPost = usePermissionRule('accounting.journals:APPROVE');
  const toast = useToast();

  const process = async (event: SourceEventInboxItem) => {
    try {
      await processEvent.mutateAsync(event.id);
      toast.success(`Posted ${getSourceEventLabel(event.sourceEventType).toLowerCase()}.`);
    } catch (error) {
      toast.error(extractError(error, 'Unable to post source event'));
    }
  };

  const retry = async (event: SourceEventInboxItem) => {
    try {
      await retryEvent.mutateAsync(event.id);
      toast.success(`Retried ${getSourceEventLabel(event.sourceEventType).toLowerCase()}.`);
    } catch (error) {
      toast.error(extractError(error, 'Unable to retry source event'));
    }
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data;
    return data.filter((event) =>
      [
        event.sourceModule,
        event.sourceEventType,
        event.sourceRecordId,
        event.journalEntry?.journalNumber,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [data, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<SourceEventInboxItem>[] = [
    {
      key: 'createdAt',
      label: 'Received',
      width: '160px',
      render: (event) => (
        <span className="text-sm text-gray-700">{formatDate(event.createdAt)}</span>
      ),
    },
    {
      key: 'sourceEventType',
      label: 'Event',
      width: 'minmax(180px, 1fr)',
      render: (event) => (
        <div>
          <div className="font-medium text-gray-900">
            {getSourceEventLabel(event.sourceEventType)}
          </div>
          <div className="text-xs text-gray-500">
            {event.sourceModule} · {event.sourceRecordId}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '120px',
      render: (event) => <Badge label={event.status} variant={STATUS_VARIANT[event.status]} />,
    },
    {
      key: 'postingRule',
      label: 'Posting Rule',
      width: 'minmax(150px, .8fr)',
      render: (event) => (
        <span className="text-sm text-gray-700">
          {event.postingRule?.name ?? 'Resolved on posting'}
        </span>
      ),
    },
    {
      key: 'journalEntry',
      label: 'Journal',
      width: '150px',
      render: (event) => (
        <span className="text-sm font-medium text-gray-700">
          {event.journalEntry ? formatJournalNumber(event.journalEntry.journalNumber) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      width: '100px',
      render: (event) => (
        <div onClick={(click) => click.stopPropagation()}>
          {canPost && event.status === 'RECEIVED' && (
            <TableButton
              variant="green"
              isLoading={processEvent.isPending}
              onClick={() => void process(event)}
            >
              Post
            </TableButton>
          )}
          {canPost && event.status === 'FAILED' && (
            <TableButton
              variant="blue"
              isLoading={retryEvent.isPending}
              onClick={() => void retry(event)}
            >
              Retry
            </TableButton>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Review events delivered by operational modules. Posting creates the linked Accounting
        journal and, for cash events, a Cashbook transaction.
      </p>
      {isError && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Unable to load the posting inbox. Check that you have journal-view access.
        </p>
      )}
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        emptyMessage="No source events found"
        searchPlaceholder="Search event, module, record or journal…"
        searchValue={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
