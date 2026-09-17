'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { DataCardGrid } from '@/components/organisms/shared/DataCardGrid';
import { ContactCard } from '@/components/molecules/ContactCard';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { AddReinsurancePanel } from '@/components/organisms/reinsurance/panels/AddReinsurancepanel';
import { AddContactPanel } from '@/components/organisms/reinsurance/panels/AddContactPanel';
import { useReinsurers, useDeleteReinsurer } from '@/hooks';
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

export function ReinsurersTable() {
  const toast = useToast();
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Counterparty | null>(null);
  const [contactTarget, setContactTarget] = useState<Counterparty | null>(null);

  const canCreate = usePermissionRule('operations.reinsurance.counterparties:CREATE');
  const canEdit = usePermissionRule('operations.reinsurance.counterparties:EDIT');
  const canDelete = usePermissionRule('operations.reinsurance.counterparties:DELETE');

  const { data = [], isLoading } = useReinsurers();
  const { mutate: deleteReinsurer, isPending: isDeleting } = useDeleteReinsurer();

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
    deleteReinsurer(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Reinsurer archived successfully');
        setDeleteTarget(null);
      },
      onError: (err) => toast.error(extractError(err, 'Failed to archive reinsurer')),
    });
  };

  return (
    <>
      <DataCardGrid
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search reinsurers…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={
          canCreate ? { label: 'Add Reinsurer', onClick: () => setPanelOpen(true) } : undefined
        }
        emptyMessage="No reinsurers found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        renderCard={(reinsurer) => (
          <ContactCard
            name={reinsurer.name}
            location={formatTerritory(reinsurer.addresses)}
            email={reinsurer.email ?? '—'}
            phone={reinsurer.phone ?? '—'}
            onClick={() =>
              router.push(`/${tenantSlug}/operations/reinsurance/reinsurers/${reinsurer.id}`)
            }
            onAddPerson={canEdit ? () => setContactTarget(reinsurer) : undefined}
            onDelete={canDelete ? () => setDeleteTarget(reinsurer) : undefined}
          />
        )}
      />

      <AddReinsurancePanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />

      <AddContactPanel counterparty={contactTarget} onClose={() => setContactTarget(null)} />

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Archive Reinsurer"
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
