'use client';

import { useState, useMemo } from 'react';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { DataCardGrid } from '@/components/organisms/shared/DataCardGrid';
import { ProjectCard } from '@/components/molecules/hr/projects/ProjectCard';
import { ProjectStatsRow } from '@/components/molecules/hr/projects/ProjectStatsRow';
import { ProjectFilterBar } from '@/components/molecules/hr/projects/ProjectFilterBar';
import { CreateProjectPanel } from '@/components/organisms/hr/projects/CreateProjectPanel';
import { useEmployeeOptions } from '@/hooks/hr/useEmployees';
import {
  useProjects,
  useMyProjects,
  useCreateProject,
  useArchiveProject,
  usePermission,
} from '@/hooks';
import { Permission } from '@/lib/permissionMap';
import { CreateProjectDto } from '@/types/hr';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';

const PAGE_SIZE = 12;

interface Props {
  tenantSlug: string;
}

function ConfirmDeleteModal({
  projectName,
  isDeleting,
  onConfirm,
  onCancel,
}: {
  projectName: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Delete Project</p>
            <p className="text-xs text-gray-500 mt-0.5">This action cannot be undone.</p>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-gray-900">{projectName}</span>?
        </p>
        <div className="flex justify-end gap-2 mt-1">
          <Button variant="outline" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            isLoading={isDeleting}
            loadingText="Deleting…"
            className="bg-red-600 hover:bg-red-700 text-white border-red-600"
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ProjectsContent({ tenantSlug }: Props) {
  const router = useRouter();
  const toast = useToastStore((s) => s.addToast);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const canViewAll = usePermission(Permission.READ_PROJECTS);
  const canManageProjects = usePermission(Permission.CREATE_PROJECT);

  const { data: allProjectsData = [], isLoading: allLoading } = useProjects();
  const { data: myProjectsData = [], isLoading: myLoading } = useMyProjects();
  const projects = canViewAll ? allProjectsData : myProjectsData;
  const isLoading = canViewAll ? allLoading : myLoading;

  const { data: employees = [] } = useEmployeeOptions();
  const createProject = useCreateProject();
  const archiveProject = useArchiveProject();

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.managerName?.toLowerCase().includes(q))
          return false;
      }
      return true;
    });
  }, [projects, search, statusFilter]);

  const metrics = useMemo(
    () => ({
      total: projects.length,
      active: projects.filter((p) => p.status === 'ACTIVE').length,
      completed: projects.filter((p) => p.status === 'COMPLETED').length,
      planning: projects.filter((p) => p.status === 'PLANNING').length,
    }),
    [projects],
  );

  const hasFilters = !!(search || statusFilter);
  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedProjects = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleCreate = async (data: CreateProjectDto) => {
    try {
      await createProject.mutateAsync(data);
      setPanelOpen(false);
    } catch (err) {
      toast({ message: extractError(err), type: 'error' });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await archiveProject.mutateAsync(deleteTarget.id);
      toast({ message: `"${deleteTarget.name}" has been deleted.`, type: 'success' });
      setDeleteTarget(null);
    } catch (err) {
      toast({ message: extractError(err), type: 'error' });
    }
  };

  return (
    <>
      {/* Header */}
      <h1 className="text-xl font-bold text-gray-900 shrink-0">Projects & Tasks</h1>

      <ProjectStatsRow isLoading={isLoading} {...metrics} />

      <DataCardGrid
        data={pagedProjects}
        isLoading={isLoading}
        skeletonCount={8}
        renderSkeleton={() => <div className="w-80 h-52 rounded-card bg-gray-100 animate-pulse" />}
        searchPlaceholder="Search by project name or manager…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={
          canManageProjects
            ? { label: 'New Project', onClick: () => setPanelOpen(true) }
            : undefined
        }
        extraFilters={
          <ProjectFilterBar
            statusFilter={statusFilter}
            onStatusChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
            showClear={hasFilters}
            onClear={clearFilters}
          />
        }
        emptyMessage="No projects found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        renderCard={(project) => (
          <ProjectCard
            project={project}
            onOpen={() => router.push(`/${tenantSlug}/hr/projects/${project.id}`)}
            onDelete={
              canManageProjects
                ? () => setDeleteTarget({ id: project.id, name: project.name })
                : undefined
            }
          />
        )}
      />

      {canManageProjects && (
        <CreateProjectPanel
          isOpen={panelOpen}
          onClose={() => setPanelOpen(false)}
          employees={employees}
          onSubmit={handleCreate}
          isSubmitting={createProject.isPending}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          projectName={deleteTarget.name}
          isDeleting={archiveProject.isPending}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
