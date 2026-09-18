'use client';

import { use } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { pageBreadcrumb, pageContent } from '@/lib/layout';
import { BrokerageReportTable } from '@/components/organisms/reinsurance/tables/BrokerageReportTable';

export default function BrokerageReportPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const base = `/${tenantSlug}/operations/reinsurance/reports`;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={`${pageBreadcrumb} shrink-0`}>
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href={base} className="hover:text-gray-700 transition-colors">
            Reports
          </Link>
          <Icons.ChevronRight className="w-5 h-5" />
          <span className="text-gray-700 font-medium">Brokerage</span>
        </nav>
      </div>

      <div className={`${pageContent} flex-1 min-h-0 overflow-y-auto flex flex-col`}>
        <BrokerageReportTable />
      </div>
    </div>
  );
}
