'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { TableButton } from '@/components/atoms/TableButton';
import { AccountingCustomer } from '@/types/accounting';
import {
  useAccountingConfig,
  useActivateCustomer,
  useCustomers,
  useDeactivateCustomer,
} from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import { AddCustomerPanel } from '../panels/AddCustomerPanel';

const PAGE_SIZE = 10;

function fmtBalance(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function CustomersTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

  const { data, isLoading } = useCustomers();
  const { data: config } = useAccountingConfig();
  const deactivateCustomer = useDeactivateCustomer();
  const activateCustomer = useActivateCustomer();

  const customers = useMemo(() => data?.items ?? [], [data]);
  const baseCurrency = config?.baseCurrency;

  function toggleActive(customer: AccountingCustomer) {
    const mutation = customer.isActive ? deactivateCustomer : activateCustomer;
    mutation.mutate(customer.id, {
      onError: (error) => addToast({ message: extractError(error), type: 'error' }),
    });
  }

  const columns: Column<AccountingCustomer>[] = [
    {
      key: 'code',
      label: 'Customer Code',
      width: '130px',
      render: (row) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 tracking-wide">
          {row.code}
        </span>
      ),
    },
    {
      key: 'legalName',
      label: 'Customer Name',
      width: 'minmax(150px, 1fr)',
      render: (row) => <span className="font-medium text-gray-900">{row.legalName}</span>,
    },
    {
      key: 'primaryContactName',
      label: 'Contact Person',
      width: 'minmax(150px, 1fr)',
      render: (row) => (
        <span className="text-gray-700 text-sm">{row.primaryContactName ?? '—'}</span>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      width: 'minmax(100px, 0.7fr)',
      render: (row) => <span className="text-gray-600 text-sm">{row.email ?? '—'}</span>,
    },
    {
      key: 'phone',
      label: 'Phone',
      width: '130px',
      render: (row) => <span className="text-gray-600 text-sm">{row.phone ?? '—'}</span>,
    },
    {
      key: 'balance',
      label: 'Outstanding Balance',
      width: '150px',
      render: (row) => (
        <span className="text-sm text-gray-700">
          {fmtBalance(row.balance.baseBalance, baseCurrency ?? row.currency)}
        </span>
      ),
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
    {
      key: 'actions',
      label: '',
      width: '120px',
      render: (row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <TableButton variant={row.isActive ? 'red' : 'green'} onClick={() => toggleActive(row)}>
            {row.isActive ? 'Deactivate' : 'Activate'}
          </TableButton>
        </div>
      ),
    },
  ];

  const filtered = useMemo(() => {
    if (!search) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (r) =>
        r.code.toLowerCase().includes(q) ||
        r.legalName.toLowerCase().includes(q) ||
        (r.primaryContactName ?? '').toLowerCase().includes(q) ||
        (r.email ?? '').toLowerCase().includes(q),
    );
  }, [customers, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search customers…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        onRowClick={(row) => router.push(`/${tenantSlug}/accounting/settings/customers/${row.id}`)}
        actionButton={{ label: 'Add Customer', onClick: () => setPanelOpen(true) }}
        emptyMessage="No customers found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <AddCustomerPanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  );
}
