//SUPER ADMIN PORTAL

'use client';

import { useState, useMemo } from 'react';
import { useTenants, useDeleteTenant } from '@/hooks/useTenants';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { WelcomeBanner } from '@/components/molecules/shared/WelcomeBanner';
import { StatCard } from '@/components/molecules/shared/StatCard';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { StatusBadge } from '@/components/molecules/shared/StatusBadge';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { AddCompanyForm } from '@/components/organisms/superadmin/AddCompanyForm';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { Company } from '@/types/tenant';
import { Building2, CalendarPlus, ShieldCheck, ShieldX } from 'lucide-react';

/* ── Icons ── */
const TotalCompaniesIcon = () => <Building2 />;
const ActiveIcon = () => <ShieldCheck />;
const InactiveIcon = () => <ShieldX />;
const CalendarIcon = () => <CalendarPlus />;

const PAGE_SIZE = 7;

const COLUMNS: Column<Company>[] = [
  {
    key: 'name',
    label: 'Company name',
    width: '2.5fr',
    render: (row) => (
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-900">{row.name}</span>
        {row.email && <span className="text-xs text-gray-400">{row.email}</span>}
      </div>
    ),
  },
  { key: 'dateCreated', label: 'Date Created', width: '1.2fr' },
  { key: 'contact', label: 'Contact Number', width: '1.2fr' },
  { key: 'industry', label: 'Industry', width: '1fr' },
  {
    key: 'status',
    label: 'Status',
    width: '1fr',
    render: (row) => <StatusBadge status={row.status} />,
  },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);

  const { mutate: deleteTenant, isPending: isDeleting } = useDeleteTenant();

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteTenant(deleteTarget.id, {
      onSuccess: () => {
        toast.success(`${deleteTarget.name} deleted`);
        setDeleteTarget(null);
      },
      onError: (err) => toast.error(extractError(err, 'Failed to delete company')),
    });
  };

  /* ── Fetch companies ── */
  const { data: apiData, isLoading } = useTenants();

  const allCompanies: Company[] = useMemo(() => {
    if (!apiData) return [];
    const list = apiData ?? [];
    return list.map(
      (c: {
        id?: string;
        _id?: string;
        name?: string;
        companyName?: string;
        email?: string;
        dateCreated?: string;
        createdAt?: string;
        phone?: string;
        contact?: string;
        contactNumber?: string;
        industry?: string;
        status?: string;
        size?: string;
        country?: string;
      }) => ({
        id: c.id ?? c._id ?? '',
        name: c.name ?? c.companyName ?? '',
        email: c.email ?? '',
        dateCreated:
          (c.dateCreated ?? c.createdAt)
            ? new Date(String(c.dateCreated ?? c.createdAt)).toLocaleDateString('en-US', {
                month: 'short',
                day: '2-digit',
                year: 'numeric',
              })
            : '—',
        contact: c.phone ?? c.contact ?? c.contactNumber ?? '—',
        industry: c.industry ?? '—',
        status: (c.status as Company['status']) ?? 'SUSPENDED',
      }),
    );
  }, [apiData]);

  /* ── Client-side search / filter ── */
  const filtered = useMemo(() => {
    let data = allCompanies;
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.contact?.includes(q) ||
          c.industry?.toLowerCase().includes(q),
      );
    }
    if (filter) data = data.filter((c) => c.status === filter);
    return data;
  }, [allCompanies, search, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* ── Stats ── */
  const stats = useMemo(
    () => ({
      total: allCompanies.length,
      active: allCompanies.filter((c) => c.status === 'ACTIVE').length,
      inactive: allCompanies.filter((c) => c.status === 'SUSPENDED').length,
      newMonth: allCompanies.filter((c) => {
        const now = new Date();
        return (
          c.dateCreated.includes(now.getFullYear().toString()) &&
          c.dateCreated.includes(now.toLocaleString('en-US', { month: 'short' }))
        );
      }).length,
    }),
    [allCompanies],
  );

  const firstName = user?.firstName ?? 'Admin';

  return (
    <>
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-6 flex flex-col gap-6 min-h-0">
        {/* Welcome banner */}
        <WelcomeBanner userName={firstName} />

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Companies"
            value={isLoading ? null : stats.total}
            icon={<TotalCompaniesIcon />}
          />
          <StatCard title="Active" value={isLoading ? null : stats.active} icon={<ActiveIcon />} />
          <StatCard
            title="Suspended"
            value={isLoading ? null : stats.inactive}
            icon={<InactiveIcon />}
          />
          <StatCard
            title="New This Month"
            value={isLoading ? null : stats.newMonth}
            icon={<CalendarIcon />}
          />
        </div>

        {/* Companies table */}
        {/* <h2 className="text-xl font-bold text-gray-900">Companies</h2> */}
        <DataTable
          columns={COLUMNS}
          data={pageData}
          isLoading={isLoading}
          searchPlaceholder="Search company name, phone, or industry..."
          onSearch={(q) => {
            setSearch(q);
            setPage(1);
          }}
          onRowClick={(row) => router.push(`/dashboard/${row.id}`)}
          filterOptions={[
            { value: 'ACTIVE', label: 'Active' },
            { value: 'INACTIVE', label: 'Inactive' },
            { value: 'SUSPENDED', label: 'Suspended' },
            { value: 'PENDING', label: 'Pending' },
          ]}
          onFilter={(v) => {
            setFilter(v);
            setPage(1);
          }}
          onExport={() => console.log('export')}
          actionButton={{ label: 'New Company', onClick: () => setPanelOpen(true) }}
          rowActions={(row) => [
            { label: 'View', onClick: () => router.push(`/dashboard/${row.id}`) },
            { label: 'Delete', danger: true, onClick: () => setDeleteTarget(row) },
          ]}
          emptyMessage="No companies onboarded"
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </main>

      {/* Add Company side panel */}
      <AddCompanyForm isOpen={panelOpen} onClose={() => setPanelOpen(false)} />

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Company"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isDeleting}
              loadingText="Deleting..."
              onClick={handleDelete}
            >
              Delete Company
            </Button>
          </div>
        }
      />
    </>
  );
}
