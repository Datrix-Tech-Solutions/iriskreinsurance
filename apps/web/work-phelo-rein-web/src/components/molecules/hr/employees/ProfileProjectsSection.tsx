'use client';

import { useParams, useRouter } from 'next/navigation';
import { Users, CalendarDays } from 'lucide-react';
import { SectionCard } from '@/components/molecules/shared/sectionCard';
import { TableButton } from '@/components/atoms/TableButton';
import { ProjectStatusBadge } from '@/components/molecules/hr/projects/ProjectStatusBadge';
import { useMyProjects } from '@/hooks/hr/useProjects';

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ProfileProjectsSection() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const { data: projects = [], isLoading } = useMyProjects();

  if (isLoading) return null;

  return (
    <SectionCard
      title="My Projects"
      scrollX
      headerAction={
        <TableButton variant="blue" onClick={() => router.push(`/${tenantSlug}/hr/projects`)}>
          Manage
        </TableButton>
      }
    >
      {projects.length === 0 ? (
        <p className="w-60 shrink-0 self-center text-sm text-gray-400">
          Not assigned to any projects.
        </p>
      ) : (
        projects.map((project) => {
          const pct = Math.max(0, Math.min(100, project.progress ?? 0));
          return (
            <button
              key={project.id}
              type="button"
              onClick={() => router.push(`/${tenantSlug}/hr/projects/${project.id}`)}
              className="w-80 shrink-0 text-left flex flex-col gap-3 p-4 rounded-2xl border border-gray-200 bg-white transition-all hover:shadow-lg hover:border-brand/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900 line-clamp-2">{project.name}</p>
                <ProjectStatusBadge status={project.status} />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>Progress</span>
                  <span className="font-semibold text-gray-900">{pct}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {project.assignedCount} {project.assignedCount === 1 ? 'member' : 'members'}
                </span>
                <span className="flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" />
                  {formatDate(project.startDate)} – {formatDate(project.endDate)}
                </span>
              </div>
            </button>
          );
        })
      )}
    </SectionCard>
  );
}
