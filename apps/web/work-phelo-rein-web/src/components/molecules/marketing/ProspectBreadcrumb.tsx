import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';

interface Props {
  tenantSlug: string;
  prospectName: string;
}

export function ProspectBreadcrumb({ tenantSlug, prospectName }: Props) {
  return (
    <nav className="flex items-center gap-2 text-sm text-gray-400">
      <Link
        href={`/${tenantSlug}/marketing/prospects/all`}
        className="hover:text-gray-700 transition-colors"
      >
        Prospects
      </Link>
      <Icons.ChevronRight className="w-4 h-4" />
      <span className="text-gray-700 font-medium">{prospectName}</span>
    </nav>
  );
}
