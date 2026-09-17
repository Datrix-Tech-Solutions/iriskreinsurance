import { CalendarDays } from 'lucide-react';
import { Project } from '@/types/hr';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import { ProjectStatusBadge } from '@/components/molecules/hr/projects/ProjectStatusBadge';
import { cardClass } from '@/lib/utils';

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface Props {
  project: Project;
}

export function ProjectBanner({ project }: Props) {
  return (
    <div className={cardClass('p-6 flex items-center gap-6')}>
      {/* Left: name + meta */}
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <h1 className="text-xl font-bold text-gray-900 truncate">{project.name}</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <ProjectStatusBadge status={project.status} />
          <span className="flex items-center gap-1.5 text-sm text-gray-500">
            <CalendarDays className="w-4 h-4 text-gray-400" />
            <span className="text-gray-400">Deadline:</span>
            <span className="font-medium text-gray-700">{formatDate(project.endDate)}</span>
          </span>
        </div>
      </div>

      {/* Right: progress */}
      <div className="shrink-0 min-w-52 flex flex-col gap-1.5">
        <p className="text-xs text-gray-400 font-medium">Progress</p>
        <ProgressBar value={project.progress ?? 0} />
      </div>
    </div>
  );
}
