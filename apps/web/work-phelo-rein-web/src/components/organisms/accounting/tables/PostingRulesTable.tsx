'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { PostingRule, PostingRuleLine } from '@/types/accounting';
import { getSourceEventLabel } from '@/config/reinsurance-event-catalog';
import { usePostingRules } from '@/hooks';
import { AddPostingRulePanel } from '@/components/organisms/accounting/panels/AddPostingRulePanel';
import {
  PostingRuleDetailPanel,
  PostingRuleLineFormModal,
} from '@/components/organisms/accounting/panels/PostingRuleDetailPanel';

const PAGE_SIZE = 10;

const ACTIVE_OPTIONS: SearchSelectOption[] = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function PostingRulesTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState('');
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<PostingRule | null>(null);
  // undefined = closed, null = adding a new line, a line = editing that line.
  const [lineModalTarget, setLineModalTarget] = useState<PostingRuleLine | null | undefined>(
    undefined,
  );

  const { data = [], isLoading } = usePostingRules({
    active: activeFilter ? activeFilter === 'true' : undefined,
  });

  // Keep the open detail panel in sync with the list refetching after a line/activation change.
  const detailRule = detailTarget
    ? (data.find((r) => r.id === detailTarget.id) ?? detailTarget)
    : null;

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.sourceModule.toLowerCase().includes(q) ||
        r.sourceEventType.toLowerCase().includes(q),
    );
  }, [search, data]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns = useMemo<Column<PostingRule>[]>(
    () => [
      {
        key: 'name',
        label: 'Name',
        width: 'minmax(180px, 1fr)',
        render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
      },
      {
        key: 'sourceModule',
        label: 'Source Module',
        width: '140px',
        render: (row) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 tracking-wide">
            {row.sourceModule}
          </span>
        ),
      },
      {
        key: 'sourceEventType',
        label: 'Source Event Type',
        width: 'minmax(180px, 1fr)',
        render: (row) => (
          <span className="text-sm text-gray-700">{getSourceEventLabel(row.sourceEventType)}</span>
        ),
      },
      {
        key: 'version',
        label: 'Version',
        width: '90px',
        render: (row) => <span className="text-sm text-gray-700">v{row.version}</span>,
      },
      {
        key: 'lines',
        label: 'Lines',
        width: '80px',
        render: (row) => <span className="text-sm text-gray-700">{row.lines.length}</span>,
      },
      {
        key: 'effectiveFrom',
        label: 'Effective From',
        width: '130px',
        render: (row) => (
          <span className="text-sm text-gray-700">{fmtDate(row.effectiveFrom)}</span>
        ),
      },
      {
        key: 'active',
        label: 'Status',
        width: '100px',
        render: (row) => (
          <Badge
            label={row.active ? 'Active' : 'Inactive'}
            variant={row.active ? 'success' : 'neutral'}
          />
        ),
      },
    ],
    [],
  );

  const extraFilters = (
    <div>
      <SearchSelect
        size="sm"
        placeholder="Status"
        options={ACTIVE_OPTIONS}
        value={activeFilter}
        onChange={(v) => {
          setActiveFilter(v);
          setPage(1);
        }}
      />
    </div>
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search posting rules…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        extraFilters={extraFilters}
        actionButton={{ label: 'New Posting Rule', onClick: () => setAddPanelOpen(true) }}
        onRowClick={(row) => setDetailTarget(row)}
        emptyMessage="No posting rules found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <AddPostingRulePanel isOpen={addPanelOpen} onClose={() => setAddPanelOpen(false)} />

      <PostingRuleDetailPanel
        rule={detailRule}
        onClose={() => setDetailTarget(null)}
        onAddLine={() => setLineModalTarget(null)}
        onEditLine={(line) => setLineModalTarget(line)}
      />

      <PostingRuleLineFormModal
        rule={detailRule}
        line={lineModalTarget}
        onClose={() => setLineModalTarget(undefined)}
      />
    </>
  );
}
