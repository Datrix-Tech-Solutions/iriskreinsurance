'use client';

import { useState, useMemo } from 'react';
// import { useParams } from 'next/navigation';
// import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { TableButton } from '@/components/atoms/TableButton';
import { TypeChip } from '@/components/atoms/TypeChip';
import { Modal } from '@/components/organisms/shared/Modal';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { AddEntityPanel } from '@/components/organisms/accounting/panels/AddEntityPanel';
import { SUBLEDGER_TYPE_LABELS, SubledgerAccount, SubledgerType } from '@/types/accounting';
import { SUBLEDGER_TYPE_CHIP_COLOR } from '@/lib/accounting/subledgerType';
import { useAccountingConfig, useDeactivateSubledger, useSubledgers } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

const PAGE_SIZE = 10;

const TYPE_FILTER_OPTIONS: SearchSelectOption[] = (
  Object.entries(SUBLEDGER_TYPE_LABELS) as [SubledgerType, string][]
).map(([value, label]) => ({ value, label }));

function fmtBalance(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function EntitiesTable() {
  // const router = useRouter();
  // const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<SubledgerType | ''>('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<SubledgerAccount | null>(null);
  const toast = useToast();

  const { data, isLoading } = useSubledgers(typeFilter ? { type: typeFilter } : {});
  const { data: config } = useAccountingConfig();
  const deactivateSubledger = useDeactivateSubledger();

  const entities = useMemo(() => data ?? [], [data]);
  const baseCurrency = config?.baseCurrency;

  const columns = useMemo<Column<SubledgerAccount>[]>(
    () => [
      {
        key: 'code',
        label: 'Entity ID',
        width: '150px',
        render: (row) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 tracking-wide">
            {row.code}
          </span>
        ),
      },
      {
        key: 'name',
        label: 'Entity Name',
        width: 'minmax(120px, 1fr)',
        render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
      },
      {
        key: 'type',
        label: 'Type',
        width: '120px',
        render: (row) => (
          <TypeChip
            label={SUBLEDGER_TYPE_LABELS[row.type]}
            color={SUBLEDGER_TYPE_CHIP_COLOR[row.type]}
          />
        ),
      },
      {
        key: 'controlAccount',
        label: 'Control Account',
        width: 'minmax(120px, 1fr)',
        render: (row) => (
          <span className="text-gray-700 text-sm">
            {row.controlAccount.code} — {row.controlAccount.name}
          </span>
        ),
      },
      {
        key: 'balance',
        label: 'Outstanding Balance',
        width: '150px',
        className: 'text-right',
        render: (row) => (
          <span className="text-sm text-gray-700">
            {fmtBalance(row.balance.baseBalance, baseCurrency ?? row.currency ?? '')}
          </span>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        width: '100px',
        render: (row) => (
          <Badge
            label={row.status === 'ACTIVE' ? 'Active' : 'Inactive'}
            variant={row.status === 'ACTIVE' ? 'success' : 'neutral'}
          />
        ),
      },
      {
        key: 'actions',
        label: '',
        width: '120px',
        render: (row) =>
          row.status === 'ACTIVE' ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <TableButton variant="red" onClick={() => setDeactivateTarget(row)}>
                Deactivate
              </TableButton>
            </div>
          ) : null,
      },
    ],
    [baseCurrency],
  );

  const filtered = useMemo(() => {
    if (!search) return entities;
    const q = search.toLowerCase();
    return entities.filter(
      (r) => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q),
    );
  }, [entities, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const confirmDeactivate = () => {
    if (!deactivateTarget) return;
    deactivateSubledger.mutate(deactivateTarget.id, {
      onSuccess: () => setDeactivateTarget(null),
      onError: (error) => toast.error(extractError(error, 'Unable to deactivate entity')),
    });
  };

  const extraFilters = (
    <div>
      <SearchSelect
        size="sm"
        placeholder="Type"
        options={TYPE_FILTER_OPTIONS}
        value={typeFilter}
        showAllOption
        onChange={(v) => {
          setTypeFilter(v as SubledgerType | '');
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
        searchPlaceholder="Search entities"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        extraFilters={extraFilters}
        // onRowClick={(row) => router.push(`/${tenantSlug}/accounting/accountspayable/entities/${row.id}`)}
        actionButton={{ label: 'Add Entity', onClick: () => setPanelOpen(true) }}
        emptyMessage="No entities found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <AddEntityPanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />

      <Modal
        isOpen={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        title="Deactivate Entity"
        description={`Are you sure you want to deactivate "${deactivateTarget?.name}"? It will no longer be available for new journal lines, and cannot currently be reactivated.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeactivateTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={deactivateSubledger.isPending}
              onClick={confirmDeactivate}
            >
              Deactivate
            </Button>
          </div>
        }
      />
    </>
  );
}
