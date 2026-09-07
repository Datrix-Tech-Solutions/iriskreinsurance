'use client';

import { useMemo, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { TableButton } from '@/components/atoms/TableButton';
import { Modal } from '@/components/organisms/shared/Modal';
import { CreateAnnouncementPanel } from '@/components/organisms/hr/announcements/CreateAnnouncementPanel';
import { AnnouncementDetailPanel } from '@/components/organisms/hr/announcements/AnnouncementDetailPanel';
import { useAnnouncementsPage, useDeleteAnnouncement } from '@/hooks';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type { Announcement } from '@/types/hr';

interface AnnouncementRow {
  id: string;
  title: string;
  message: string;
  expiresAt?: string | null;
  notifyEmail: boolean;
  notifySms: boolean;
  raw: Announcement;
}

function buildColumns(
  canManageAnnouncements: boolean,
  onView: (row: AnnouncementRow) => void,
  onDelete: (row: AnnouncementRow) => void,
): Column<AnnouncementRow>[] {
  return [
    {
      key: 'title',
      label: 'Title',
      width: 'minmax(100px, 1fr)',
      render: (row) => <span className="font-medium text-gray-900">{row.title}</span>,
    },
    {
      key: 'message',
      label: 'Message',
      width: 'minmax(200px, 2.5fr)',
      render: (row) => <span className="text-gray-500 line-clamp-1">{row.message}</span>,
    },
    {
      key: 'expiresAt',
      label: 'Expires',
      width: '100px',
      render: (row) => (
        <span className="text-gray-600">
          {row.expiresAt
            ? new Date(row.expiresAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : 'No expiry'}
        </span>
      ),
    },
    {
      key: 'notifyEmail',
      label: 'Email',
      width: '90px',
      render: (row) =>
        row.notifyEmail ? (
          <Badge label="Yes" variant="success" />
        ) : (
          <Badge label="No" variant="neutral" />
        ),
    },
    {
      key: 'notifySms',
      label: 'SMS',
      width: '90px',
      render: (row) =>
        row.notifySms ? (
          <Badge label="Yes" variant="success" />
        ) : (
          <Badge label="No" variant="neutral" />
        ),
    },
    {
      key: 'actions' as keyof AnnouncementRow,
      label: '',
      width: canManageAnnouncements ? '150px' : '80px',
      render: (row) => (
        <div className="flex items-center gap-3">
          <TableButton variant="blue" onClick={() => onView(row)}>
            View
          </TableButton>
          {canManageAnnouncements && (
            <TableButton variant="red" onClick={() => onDelete(row)}>
              Delete
            </TableButton>
          )}
        </div>
      ),
    },
  ];
}

export function AnnouncementsContent() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [viewTarget, setViewTarget] = useState<Announcement | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const canReadAnnouncements = usePermission(Permission.READ_ANNOUNCEMENTS);
  const canManageAnnouncements = usePermission(Permission.MANAGE_ANNOUNCEMENTS);
  const canAccessAnnouncements = canReadAnnouncements || canManageAnnouncements;
  const toast = useToast();

  const { items, meta, isLoading } = useAnnouncementsPage({
    page,
    limit: 10,
    search: search || undefined,
    view: canManageAnnouncements ? 'all' : 'visible',
  });

  const { mutate: deleteAnnouncement, isPending: isDeleting } = useDeleteAnnouncement();

  const rows = useMemo<AnnouncementRow[]>(
    () =>
      items.map((announcement: Announcement) => {
        const channels = announcement.deliveryChannels ?? ['IN_APP'];

        return {
          id: announcement.id,
          title: announcement.title,
          message: announcement.body,
          expiresAt: announcement.expiresAt,
          notifyEmail: channels.includes('EMAIL') || announcement.sendEmail,
          notifySms: channels.includes('SMS'),
          raw: announcement,
        };
      }),
    [items],
  );

  const columns = useMemo(
    () =>
      buildColumns(
        canManageAnnouncements,
        (row) => setViewTarget(row.raw),
        (row) => setDeleteTarget({ id: row.id, title: row.title }),
      ),
    [canManageAnnouncements],
  );

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteAnnouncement(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Announcement deleted');
        setDeleteTarget(null);
      },
      onError: (err: unknown) => toast.error(extractError(err, 'Failed to delete announcement')),
    });
  };

  return (
    <>
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Announcements</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {meta.total} announcement{meta.total !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        emptyMessage="No announcements yet"
        emptyImage={
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <Megaphone className="w-7 h-7 text-gray-400" />
          </div>
        }
        searchPlaceholder="Search announcements…"
        searchValue={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        actionButton={
          canManageAnnouncements
            ? { label: 'New Announcement', onClick: () => setPanelOpen(true) }
            : undefined
        }
        currentPage={page}
        totalPages={Math.max(1, meta.totalPages)}
        onPageChange={setPage}
        noInternalScroll
      />

      {canAccessAnnouncements && canManageAnnouncements && (
        <CreateAnnouncementPanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />
      )}

      <AnnouncementDetailPanel
        isOpen={!!viewTarget}
        onClose={() => setViewTarget(null)}
        announcement={viewTarget}
      />

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        title="Delete Announcement?"
        description={`Are you sure you want to delete "${deleteTarget?.title}"? This cannot be undone.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              isLoading={isDeleting}
              loadingText="Deleting…"
              className="bg-red-600 hover:bg-red-700 text-white border-red-600"
            >
              Delete
            </Button>
          </>
        }
      />
    </>
  );
}
