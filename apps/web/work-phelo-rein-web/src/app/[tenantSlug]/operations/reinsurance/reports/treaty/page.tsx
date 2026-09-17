'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { TwoPanelShell } from '@/components/organisms/shared/TwoPanelShell';
import { ReportFilterForm } from '@/components/molecules/shared/ReportFilterForm';
import { ReportHero } from '@/components/molecules/shared/ReportHero';

export default function TreatyReportPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const base = `/${tenantSlug}/operations/reinsurance/reports`;
  const [years, setYears] = useState<string[]>([]);

  return (
    <TwoPanelShell
      header={
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href={base} className="hover:text-gray-700 transition-colors">
            Reports
          </Link>
          <Icons.ChevronRight className="w-5 h-5" />
          <span className="text-gray-700 font-medium">Treaty</span>
        </nav>
      }
      leftPanel={<ReportFilterForm onGenerate={setYears} />}
      rightPanel={
        <>
          <ReportHero title="Treaty" years={years} />
          {years.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-gray-400">Select fiscal year to generate report</p>
            </div>
          ) : (
            <div className="flex-1">{/* report content goes here */}</div>
          )}
        </>
      }
    />
  );
}
