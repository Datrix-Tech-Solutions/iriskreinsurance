'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { AccountingCurrency, ExchangeRate } from '@/types/accounting';
import {
  useAccountingConfig,
  useAccountingCurrencies,
  useDeactivateAccountingCurrency,
  useExchangeRates,
  useUpdateAccountingCurrency,
} from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import { AddCurrencyPanel } from '@/components/organisms/accounting/panels/AddCurrencyPanel';
import { EditCurrencyPanel } from '@/components/organisms/accounting/panels/EditCurrencyPanel';

const PAGE_SIZE = 10;

export function AccountingCurrenciesTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<AccountingCurrency | null>(null);
  const [editTarget, setEditTarget] = useState<AccountingCurrency | null>(null);
  const [addPanelOpen, setAddPanelOpen] = useState(false);

  const { data = [], isLoading } = useAccountingCurrencies();
  const { data: config } = useAccountingConfig();
  const { data: exchangeRates = [] } = useExchangeRates();
  const deactivateCurrency = useDeactivateAccountingCurrency();
  const updateCurrency = useUpdateAccountingCurrency();
  const addToast = useToastStore((s) => s.addToast);

  const baseCurrency = config?.baseCurrency;

  // exchangeRates is ordered by effectiveAt desc, so the first match per fromCurrency is the latest rate.
  const rateByCode = useMemo(() => {
    const map = new Map<string, ExchangeRate>();
    if (!baseCurrency) return map;
    for (const r of exchangeRates) {
      if (r.toCurrency === baseCurrency && r.isActive && !map.has(r.fromCurrency)) {
        map.set(r.fromCurrency, r);
      }
    }
    return map;
  }, [exchangeRates, baseCurrency]);

  const columns = useMemo<Column<AccountingCurrency>[]>(
    () => [
      {
        key: 'name',
        label: 'Currency',
        width: 'minmax(150px, 1fr)',
        render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
      },
      {
        key: 'code',
        label: 'ISO Code',
        width: '150px',
        render: (row) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 tracking-wide">
            {row.code}
          </span>
        ),
      },
      {
        key: 'exchangeRate',
        label: 'Exchange Rate',
        width: '200px',
        render: (row) => {
          if (baseCurrency && row.code === baseCurrency) {
            return <span className="text-gray-700 text-sm font-medium">Base Currency</span>;
          }
          const rate = rateByCode.get(row.code);
          return (
            <span className="text-gray-700 text-sm">
              {rate !== undefined ? parseFloat(rate.rate).toFixed(4) : '—'}
            </span>
          );
        },
      },
      {
        key: 'isActive',
        label: 'Status',
        width: '100px',
        render: (row) => (
          <Badge
            label={row.isActive ? 'Active' : 'Inactive'}
            variant={row.isActive ? 'success' : 'neutral'}
          />
        ),
      },
    ],
    [baseCurrency, rateByCode],
  );

  function deactivate(currency: AccountingCurrency) {
    deactivateCurrency.mutate(currency.id, {
      onSuccess: () => setDeleteTarget(null),
      onError: (error) => addToast({ message: extractError(error), type: 'error' }),
    });
  }

  function reactivate(currency: AccountingCurrency) {
    updateCurrency.mutate(
      { id: currency.id, isActive: true },
      { onError: (error) => addToast({ message: extractError(error), type: 'error' }) },
    );
  }

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter((r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q));
  }, [search, data]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search currencies…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={{
          label: 'Add Currency',
          onClick: () => setAddPanelOpen(true),
        }}
        rowActions={(row) => [
          { label: 'Update', onClick: () => setEditTarget(row) },
          {
            label: row.isActive ? 'Deactivate' : 'Reactivate',
            onClick: () => (row.isActive ? setDeleteTarget(row) : reactivate(row)),
            danger: row.isActive,
          },
        ]}
        emptyMessage="No currencies found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        // noInternalScroll
      />

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Deactivate Currency"
        description={`Are you sure you want to deactivate "${deleteTarget?.name}"? It will no longer be selectable for new transactions.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={deactivateCurrency.isPending}
              onClick={() => deleteTarget && deactivate(deleteTarget)}
            >
              Deactivate
            </Button>
          </div>
        }
      />

      <AddCurrencyPanel isOpen={addPanelOpen} onClose={() => setAddPanelOpen(false)} />

      <EditCurrencyPanel
        currency={editTarget}
        baseCurrency={baseCurrency}
        existingRate={editTarget ? rateByCode.get(editTarget.code) : undefined}
        onClose={() => setEditTarget(null)}
      />
    </>
  );
}
