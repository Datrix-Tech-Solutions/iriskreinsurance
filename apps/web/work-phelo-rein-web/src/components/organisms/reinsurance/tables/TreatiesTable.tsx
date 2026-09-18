'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { TreatyStatusBadge } from '@/components/molecules/reinsurance/TreatyStatusBadge';
import { TreatyTypeSelectorModal } from '@/components/organisms/reinsurance/TreatyTypeSelectorModal';
import { CreateQuotaSharePanel } from '@/components/organisms/reinsurance/panels/CreateQuotaSharePanel';
import { CreateSurplusPanel } from '@/components/organisms/reinsurance/panels/CreateSurplusPanel';
import { CreateFacObligatoryPanel } from '@/components/organisms/reinsurance/panels/CreateFacObligatoryPanel';
import { CreateExcessOfLossPanel } from '@/components/organisms/reinsurance/panels/CreateExcessOfLossPanel';
import { Treaty, TreatyType, TreatyStatus, TREATY_STATUSES } from '@/types/reinsurance';

const PAGE_SIZE = 10;

function fmtMonth(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

const STATUS_FILTER_OPTIONS = TREATY_STATUSES.map((s) => ({ value: s, label: s }));

// TODO: replace with useTreaties() hook once API is ready
const MOCK_DATA: Treaty[] = [
  {
    id: '1',
    name: 'Quota Share Treaty 1',
    type: 'Quota Share',
    classofBusiness: 'Property',
    cedant: 'Glico Insurance',
    share: 25,
    periodStart: '2023-01-01',
    periodEnd: '2023-12-31',
    year: 2026,
    status: 'Active',
    accountingArrangement: 'Quarterly',
  },
];

const COLUMNS: Column<Treaty>[] = [
  {
    key: 'name',
    label: 'Treaty Name',
    width: '2fr',
    render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
  },
  {
    key: 'type',
    label: 'Type',
    width: '1.4fr',
    render: (row) => <span className="text-gray-700">{row.type}</span>,
  },
  {
    key: 'classOfBusiness',
    label: 'Risk Type',
    width: '1.4fr',
    render: (row) => <span className="text-gray-700">{row.classofBusiness}</span>,
  },
  {
    key: 'cedant',
    label: 'Cedant',
    width: '2fr',
    render: (row) => <span className="text-gray-600">{row.cedant}</span>,
  },
  {
    key: 'share',
    label: 'Share',
    width: '80px',
    render: (row) => <span className="text-gray-700">{row.share}%</span>,
  },
  {
    key: 'accountingArrangement',
    label: 'Accounting Arrangement',
    width: '2fr',
    render: (row) => <span className="text-gray-700">{row.accountingArrangement}</span>,
  },
  {
    key: 'period',
    label: 'Period',
    width: '1.5fr',
    render: (row) => (
      <span className="text-gray-600">
        {fmtMonth(row.periodStart)} – {fmtMonth(row.periodEnd)}
      </span>
    ),
  },
  {
    key: 'year',
    label: 'Year',
    width: '70px',
    render: (row) => <span className="text-gray-700">{row.year}</span>,
  },
  {
    key: 'status',
    label: 'Status',
    width: '110px',
    render: (row) => <TreatyStatusBadge status={row.status} />,
  },
];

export function TreatiesTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  /* Step 1: type selector modal */
  const [typeModalOpen, setTypeModalOpen] = useState(false);

  /* Step 2: specific form panel based on selected type */
  const [activeType, setActiveType] = useState<TreatyType | null>(null);

  const handleTypeSelect = (type: TreatyType) => {
    setTypeModalOpen(false);
    setActiveType(type);
  };

  const filtered = useMemo(() => {
    let rows = MOCK_DATA;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.cedant.toLowerCase().includes(q) ||
          r.type.toLowerCase().includes(q),
      );
    }
    if (statusFilter) {
      rows = rows.filter((r) => r.status === (statusFilter as TreatyStatus));
    }
    return rows;
  }, [search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const goToTreaty = (treaty: Treaty) =>
    router.push(`/${tenantSlug}/operations/reinsurance/treaty/${treaty.id}`);

  return (
    <>
      <DataTable
        columns={COLUMNS}
        data={paged}
        searchPlaceholder="Search treaties…"
        searchValue={search}
        onRowClick={goToTreaty}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        extraFilters={
          <div>
            <SearchSelect
              size="sm"
              placeholder="Status"
              options={STATUS_FILTER_OPTIONS}
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            />
          </div>
        }
        onExport={() => {
          /* TODO: implement export */
        }}
        actionButton={{ label: 'New Treaty', onClick: () => setTypeModalOpen(true) }}
        rowActions={(row) => [
          {
            label: 'View',
            onClick: () => goToTreaty(row),
          },
          {
            label: 'Edit',
            onClick: () => {
              /* TODO */
            },
          },
          {
            label: 'Delete',
            onClick: () => {
              /* TODO */
            },
            danger: true,
          },
        ]}
        emptyMessage="No treaties found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <TreatyTypeSelectorModal
        isOpen={typeModalOpen}
        onClose={() => setTypeModalOpen(false)}
        onSelect={handleTypeSelect}
      />

      <CreateQuotaSharePanel
        isOpen={activeType === 'Quota Share'}
        onClose={() => setActiveType(null)}
      />
      <CreateSurplusPanel isOpen={activeType === 'Surplus'} onClose={() => setActiveType(null)} />
      <CreateFacObligatoryPanel
        isOpen={activeType === 'Fac. Obligatory Treaty'}
        onClose={() => setActiveType(null)}
      />
      <CreateExcessOfLossPanel
        isOpen={activeType === 'Excess of Loss'}
        onClose={() => setActiveType(null)}
      />
    </>
  );
}
