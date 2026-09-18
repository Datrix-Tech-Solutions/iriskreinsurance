'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import {
  AddAllowancePanel,
  CompanyAllowance,
  AllowanceFormValues,
} from '@/components/organisms/hr/companyPolicies/AddAllowancePanel';
import { ALLOWANCE_TYPE_LABEL } from '@/lib/payrollUtils';

const COLUMNS: Column<CompanyAllowance>[] = [
  { key: 'name', label: 'Name' },
  {
    key: 'type',
    label: 'Type',
    render: (row) => ALLOWANCE_TYPE_LABEL[row.type] ?? row.type,
  },
  {
    key: 'description',
    label: 'Description',
    render: (row) => row.description || <span className="text-gray-400">—</span>,
  },
  {
    key: 'createdAt',
    label: 'Created',
    render: (row) =>
      new Date(row.createdAt).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
  },
];

const PAGE_SIZE = 10;

export default function AllowancesPage() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedAllowance, setSelectedAllowance] = useState<CompanyAllowance | null>(null);
  const [allowances, setAllowances] = useState<CompanyAllowance[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = allowances.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (ALLOWANCE_TYPE_LABEL[a.type] ?? a.type).toLowerCase().includes(search.toLowerCase()),
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSubmit = (data: AllowanceFormValues) => {
    if (selectedAllowance) {
      setAllowances((prev) =>
        prev.map((a) => (a.id === selectedAllowance.id ? { ...a, ...data } : a)),
      );
    } else {
      setAllowances((prev) => [
        {
          id: crypto.randomUUID(),
          ...data,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
    setPanelOpen(false);
    setSelectedAllowance(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between shrink-0">
        <p className="text-sm text-gray-500">
          Define allowance types that can be assigned to employees.
        </p>
        <Button onClick={() => setPanelOpen(true)}>+ Add Allowance</Button>
      </div>

      <DataTable
        columns={COLUMNS}
        data={paginated}
        emptyMessage="No allowances defined yet"
        searchPlaceholder="Search by name or type…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
        rowActions={(row) => [
          {
            label: 'Edit',
            onClick: () => {
              setSelectedAllowance(row);
              setPanelOpen(true);
            },
          },
          {
            label: 'Delete',
            danger: true,
            onClick: () => setAllowances((prev) => prev.filter((a) => a.id !== row.id)),
          },
        ]}
      />

      <AddAllowancePanel
        isOpen={panelOpen}
        onClose={() => {
          setPanelOpen(false);
          setSelectedAllowance(null);
        }}
        allowance={selectedAllowance}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
