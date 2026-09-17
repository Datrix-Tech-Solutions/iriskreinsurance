'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Button } from '@/components/atoms/Button';
import { TableButton } from '@/components/atoms/TableButton';
import { Modal } from '@/components/organisms/shared/Modal';
import { CreatePublicHolidayPanel } from '@/components/organisms/hr/leave/CreatePublicHolidayPanel';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useDeletePublicHoliday } from '@/hooks/hr/usePublicHolidays';
import { extractError } from '@/lib/extractError';
import { formatHolidayDate } from '@/lib/formatters';
import { PublicHoliday } from '@/types/hr';

interface Props {
  tenantSlug: string;
}

export function PublicHolidaysList({ tenantSlug }: Props) {
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editHoliday, setEditHoliday] = useState<PublicHoliday | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<PublicHoliday | null>(null);

  const limit = 10;

  const currentYear = new Date().getFullYear();

  const { data, isLoading } = useQuery({
    queryKey: ['public-holidays', { year: currentYear }],
    queryFn: () =>
      api.get('/hr/leave/public-holidays', { params: { year: currentYear } }).then((r) => r.data),
  });

  const { filteredHolidays, totalPages } = useMemo(() => {
    const raw: PublicHoliday[] = Array.isArray(data) ? data : (data?.data ?? data?.holidays ?? []);

    // Guard: keep only current-year holidays in case the backend returns all years
    const all = raw.filter((h) => new Date(h.date).getFullYear() === currentYear);

    const filtered = search
      ? all.filter((h) => h.name.toLowerCase().includes(search.toLowerCase()))
      : all;
    const pages = Math.max(1, Math.ceil(filtered.length / limit));
    const start = (page - 1) * limit;
    return { filteredHolidays: filtered.slice(start, start + limit), totalPages: pages };
  }, [data, search, page, limit, currentYear]);

  const { mutate: deleteHoliday, isPending: isDeleting } = useDeletePublicHoliday();
  const formatScope = (holiday: PublicHoliday) => {
    if (holiday.countryScope) {
      return holiday.countryScope
        .split(/\s+/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    }
    return 'Company-wide';
  };

  const columns: Column<PublicHoliday>[] = [
    {
      key: 'name',
      label: 'Holiday Name',
      width: 'minmax(150px, 1fr)',
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'date',
      label: 'Official Date',
      width: '130px',
      render: (row) => <span className="text-gray-700">{formatHolidayDate(row.date)}</span>,
    },
    {
      key: 'observedDate',
      label: 'Observed',
      width: '130px',
      render: (row) => (
        <div>
          <span className="text-gray-700">{formatHolidayDate(row.observedDate ?? row.date)}</span>
          {row.isObservedShifted && <p className="text-xs text-amber-600">shifted from weekend</p>}
        </div>
      ),
    },
    {
      key: 'countryScope',
      label: 'Scope',
      width: '130px',
      render: (row) => <span className="text-gray-600">{formatScope(row)}</span>,
    },
    {
      key: 'actions',
      label: '',
      width: '150px',
      render: (row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <TableButton
            variant="blue"
            onClick={() => {
              setEditHoliday(row);
              setPanelOpen(true);
            }}
          >
            View
          </TableButton>
          <TableButton variant="red" onClick={() => setDeleteTarget(row)}>
            Delete
          </TableButton>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col">
      <DataTable
        columns={columns}
        data={filteredHolidays}
        isLoading={isLoading}
        searchPlaceholder="Search holidays..."
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        actionButton={{
          label: 'Add Holiday',
          onClick: () => {
            setEditHoliday(undefined);
            setPanelOpen(true);
          },
        }}
        emptyMessage="No public holidays added yet"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <CreatePublicHolidayPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        tenantSlug={tenantSlug}
        editHoliday={editHoliday}
      />

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Public Holiday"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isDeleting}
              loadingText="Deleting..."
              onClick={() =>
                deleteTarget &&
                deleteHoliday(deleteTarget.id, {
                  onSuccess: () => {
                    toast.success('Holiday deleted');
                    setDeleteTarget(null);
                  },
                  onError: (err) => toast.error(extractError(err, 'Something went wrong')),
                })
              }
            >
              Delete
            </Button>
          </div>
        }
      />
    </div>
  );
}
