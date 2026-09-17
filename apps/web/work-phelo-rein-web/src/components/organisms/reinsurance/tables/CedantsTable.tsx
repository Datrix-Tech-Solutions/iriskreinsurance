'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { DataCardGrid } from '@/components/organisms/shared/DataCardGrid';
import { ContactCard } from '@/components/molecules/ContactCard';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { AddCedantPanel } from '@/components/organisms/reinsurance/panels/AddCedantPanel';
import { AddContactPanel } from '@/components/organisms/reinsurance/panels/AddContactPanel';
import { useCedants, useDeleteCedant, useCedantOutstandingCounts } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { usePermissionRule } from '@/hooks/hr/usePermission';
import { extractError } from '@/lib/extractError';
import { Counterparty } from '@/types/reinsurance';
import { codeToCountry } from '@/lib/geo';

const PAGE_SIZE = 12;

function formatTerritory(addresses: Counterparty['addresses']): string {
  const primary = addresses.find((a) => a.isPrimary) ?? addresses[0];
  if (!primary) return '—';
  const country = codeToCountry(primary.country);
  return primary.state ? `${primary.state}, ${country}` : country;
}

export function CedantsTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Counterparty | null>(null);
  const [contactTarget, setContactTarget] = useState<Counterparty | null>(null);

  const canCreate = usePermissionRule('operations.reinsurance.counterparties:CREATE');
  const canEdit = usePermissionRule('operations.reinsurance.counterparties:EDIT');
  const canDelete = usePermissionRule('operations.reinsurance.counterparties:DELETE');

  const { data = [], isLoading } = useCedants();
  const { mutate: deleteCedant, isPending: isDeleting } = useDeleteCedant();
  const outstandingCounts = useCedantOutstandingCounts();

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.email ?? '').toLowerCase().includes(q) ||
        (r.phone ?? '').includes(q),
    );
  }, [data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteCedant(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Cedant archived successfully');
        setDeleteTarget(null);
      },
      onError: (err) => toast.error(extractError(err, 'Failed to archive cedant')),
    });
  };

  return (
    <>
      <DataCardGrid
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search cedants…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={
          canCreate ? { label: 'Add Cedant', onClick: () => setPanelOpen(true) } : undefined
        }
        emptyMessage="No cedants found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        renderCard={(cedant) => {
          const outstanding = outstandingCounts.get(cedant.id) ?? 0;
          return (
            <ContactCard
              name={cedant.name}
              location={formatTerritory(cedant.addresses)}
              email={cedant.email ?? '—'}
              phone={cedant.phone ?? '—'}
              badge={outstanding > 0 ? { count: outstanding, label: 'Unpaid Policy' } : undefined}
              onClick={() =>
                router.push(`/${tenantSlug}/operations/reinsurance/cedants/${cedant.id}`)
              }
              onAddPerson={canEdit ? () => setContactTarget(cedant) : undefined}
              onDelete={canDelete ? () => setDeleteTarget(cedant) : undefined}
            />
          );
        }}
      />

      <AddCedantPanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />

      <AddContactPanel counterparty={contactTarget} onClose={() => setContactTarget(null)} />

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Archive Cedant"
        description={`Are you sure you want to archive "${deleteTarget?.name}"? It will no longer appear in lists.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isDeleting}
              loadingText="Archiving…"
              onClick={handleDelete}
            >
              Archive
            </Button>
          </div>
        }
      />
    </>
  );
}
