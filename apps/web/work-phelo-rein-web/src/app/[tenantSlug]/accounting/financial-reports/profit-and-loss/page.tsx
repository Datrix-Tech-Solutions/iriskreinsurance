'use client';

import { use } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { TwoPanelShell } from '@/components/organisms/shared/TwoPanelShell';
import { FinancialReportView } from '@/components/organisms/accounting/FinancialReportView';

export default function ProfitAndLossPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const base = `/${tenantSlug}/accounting/financial-reports`;

  return (
    <TwoPanelShell
      header={
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href={base} className="hover:text-gray-700 transition-colors">
            Financial Reports
          </Link>
          <Icons.ChevronRight className="w-5 h-5" />
          <span className="text-gray-700 font-medium">Profit &amp; Loss Statement</span>
        </nav>
      }
      rightPanel={<FinancialReportView kind="income-statement" />}
    />
  );
}
