import Link from 'next/link';
import { StatusBadge } from '@/components/molecules/shared/StatusBadge';

interface Props {
  tenantSlug: string;
  cycleTitle?: string;
  employeeName: string;
  overallStatus: string;
}

export function AppraisalHeader({ tenantSlug, cycleTitle, employeeName, overallStatus }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <nav className="flex items-center gap-1.5 text-xs text-gray-400">
        <Link href={`/${tenantSlug}/hr/appraisal`} className="hover:text-gray-600">
          Appraisals
        </Link>
        <span>/</span>
        <span className="text-gray-600">{cycleTitle || 'Cycle Results'}</span>
        <span>/</span>
        <span className="text-gray-700 font-medium">Detail</span>
      </nav>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">Appraisal Detail</h1>
        <StatusBadge status={overallStatus} />
      </div>

      <p className="text-lg text-gray-600">{employeeName}</p>
    </div>
  );
}
