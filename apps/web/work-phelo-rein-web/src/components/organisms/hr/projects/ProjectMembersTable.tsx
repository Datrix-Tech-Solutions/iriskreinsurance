'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { TableButton } from '@/components/atoms/TableButton';
import { Avatar } from '@/components/atoms/Avatar';
import { AssignProjectMemberPanel } from '@/components/organisms/hr/projects/AssignProjectMemberPanel';
import {
  useProjectMembers,
  useAddProjectMember,
  useRemoveProjectMember,
  useProject,
  useMyProfile,
  usePermission,
} from '@/hooks';
import { Permission } from '@/lib/permissionMap';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import type { ProjectMember } from '@/types/hr';

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  MANAGER: 'Project Lead',
  MEMBER: 'Member',
};

interface Props {
  projectId: string;
}

export function ProjectMembersTable({ projectId }: Props) {
  const toast = useToastStore((s) => s.addToast);

  const [panelOpen, setPanelOpen] = useState(false);
  const [search, setSearch] = useState('');

  const canManageProjects = usePermission(Permission.ASSIGN_PROJECT);
  const { data: myProfile } = useMyProfile();
  const { data: project } = useProject(projectId);
  const isProjectManager = !!(
    project?.managerId &&
    myProfile?.id &&
    project.managerId === myProfile.id
  );
  const canAssign = canManageProjects || isProjectManager;

  const { data: members = [], isLoading } = useProjectMembers(projectId);
  const addMember = useAddProjectMember();
  const removeMember = useRemoveProjectMember();

  const assignedIds = useMemo(() => new Set(members.map((m) => m.employeeId)), [members]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.department?.toLowerCase().includes(q) ||
        m.jobTitle?.toLowerCase().includes(q),
    );
  }, [members, search]);

  const handleAssign = async (employeeIds: string[]) => {
    try {
      await Promise.all(
        employeeIds.map((employeeId) => addMember.mutateAsync({ projectId, data: { employeeId } })),
      );
      setPanelOpen(false);
    } catch (err) {
      toast({ message: extractError(err), type: 'error' });
    }
  };

  const handleRemove = async (employeeId: string) => {
    try {
      await removeMember.mutateAsync({ projectId, employeeId });
    } catch (err) {
      toast({ message: extractError(err), type: 'error' });
    }
  };

  const COLUMNS: Column<ProjectMember>[] = [
    {
      key: 'name',
      label: 'Employee',
      width: 'minmax(200px, 1.5fr)',
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.name} avatarUrl={row.avatarUrl} size="sm" />
          <div>
            <p className="font-medium text-gray-900">{row.name}</p>
            {row.jobTitle && <p className="text-xs text-gray-400">{row.jobTitle}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'department',
      label: 'Department',
      width: '180px',
      render: (row) => <span>{row.department ?? '—'}</span>,
    },
    {
      key: 'role',
      label: 'Role',
      width: '120px',
      render: (row) => (
        <span className="text-sm font-medium text-gray-700">
          {ROLE_LABELS[row.role] ?? row.role}
        </span>
      ),
    },
    ...(canAssign
      ? [
          {
            key: 'employeeId' as keyof ProjectMember,
            label: '',
            width: '80px',
            render: (row: ProjectMember) => {
              if (row.role === 'OWNER') return null;
              const isLead = row.role === 'MANAGER';
              return (
                <div onClick={(e) => e.stopPropagation()}>
                  <TableButton
                    variant="red"
                    onClick={() => {
                      if (!isLead) handleRemove(row.employeeId);
                    }}
                    disabled={isLead || removeMember.isPending}
                    tooltip={isLead ? "Project lead can't be removed" : undefined}
                  >
                    Remove
                  </TableButton>
                </div>
              );
            },
          },
        ]
      : []),
  ];

  return (
    <>
      <DataTable
        columns={COLUMNS}
        data={filtered}
        isLoading={isLoading}
        noInternalScroll
        searchPlaceholder="Search members…"
        searchValue={search}
        onSearch={setSearch}
        actionButton={
          canAssign ? { label: 'Assign Members', onClick: () => setPanelOpen(true) } : undefined
        }
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        emptyMessage="No members found"
      />

      {canAssign && (
        <AssignProjectMemberPanel
          isOpen={panelOpen}
          onClose={() => setPanelOpen(false)}
          assignedIds={assignedIds}
          onAssign={handleAssign}
          isAssigning={addMember.isPending}
        />
      )}
    </>
  );
}
