import { Users, CalendarDays } from 'lucide-react';
import { Project } from '@/types/hr';
import { ProjectStatusBadge } from '@/components/molecules/hr/projects/ProjectStatusBadge';
import { DataCard, DataCardAction, DataCardDetail } from '@/components/organisms/shared/DataCard';

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface ProjectCardProps {
  project: Project;
  onOpen?: () => void;
  onDelete?: () => void;
}

export function ProjectCard({ project, onOpen, onDelete }: ProjectCardProps) {
  const actions: DataCardAction[] = [];

  if (onOpen) {
    actions.push({
      label: 'Open',
      onClick: onOpen,
      className: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
    });
  }
  if (onDelete) {
    actions.push({
      label: 'Delete',
      onClick: onDelete,
      className: 'bg-red-50 text-red-600 hover:bg-red-100',
    });
  }

  const details: DataCardDetail[] = [
    {
      label: (
        <>
          <CalendarDays className="w-3 h-3" /> Start
        </>
      ),
      value: (
        <span className="text-xs font-semibold text-gray-700">{formatDate(project.startDate)}</span>
      ),
    },
    {
      label: (
        <>
          <CalendarDays className="w-3 h-3" /> End
        </>
      ),
      value: (
        <span className="text-xs font-semibold text-gray-700">{formatDate(project.endDate)}</span>
      ),
    },
    ...(project.budget != null
      ? [
          {
            label: 'Budget',
            value: (
              <span className="text-xs font-semibold text-gray-700">
                GHS {project.budget.toLocaleString()}
              </span>
            ),
          },
        ]
      : []),
    {
      label: (
        <>
          <Users className="w-3 h-3" /> Assigned
        </>
      ),
      value: (
        <span className="text-xs font-semibold text-gray-700">
          {project.assignedCount} {project.assignedCount === 1 ? 'employee' : 'employees'}
        </span>
      ),
    },
  ];

  return (
    <DataCard
      onClick={onOpen}
      icon={
        <div className="w-10 h-10 rounded-lg bg-brand-tint flex items-center justify-center shrink-0">
          <span className="text-brand font-bold text-sm">
            {project.name.substring(0, 2).toUpperCase()}
          </span>
        </div>
      }
      title={project.name}
      subtitle={project.managerName ? `PM: ${project.managerName}` : undefined}
      badge={<ProjectStatusBadge status={project.status} />}
      note={
        project.description && (
          <p className="text-xs text-gray-500 line-clamp-2">{project.description}</p>
        )
      }
      details={details}
      actions={actions}
    />
  );
}
