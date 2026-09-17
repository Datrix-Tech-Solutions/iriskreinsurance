import { Project } from '@/types/hr';
import { cardClass } from '@/lib/utils';

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatBudget(amount?: number) {
  if (amount == null) return '—';
  return `GHC ${amount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface DetailFieldProps {
  label: string;
  value: string;
}

function DetailField({ label, value }: DetailFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}

interface Props {
  project: Project;
}

export function ProjectDetailsCard({ project }: Props) {
  return (
    <div className={cardClass('p-6 grid grid-cols-4 gap-6')}>
      <DetailField label="Project Owner" value={project.managerName ?? '—'} />
      <DetailField label="Start Date" value={formatDate(project.startDate)} />
      <DetailField label="End Date" value={formatDate(project.endDate)} />
      <DetailField label="Budget" value={formatBudget(project.budget)} />
    </div>
  );
}
