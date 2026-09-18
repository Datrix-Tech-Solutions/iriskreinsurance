import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';

interface BreadcrumbProps {
  tenantSlug: string;
  name: string;
}

export function Breadcrumb({ tenantSlug, name }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-2 text-sm text-gray-400">
      <Link href={`/${tenantSlug}/hr/employees`} className="hover:text-gray-700 transition-colors">
        Employees
      </Link>
      <Icons.ChevronRight className="w-5 h-5" />
      <span className="text-gray-700 font-medium">{name}</span>
    </nav>
  );
}
