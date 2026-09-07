'use client';

import { useRouter, useParams } from 'next/navigation';
import { TrendingUp, Scale, BookOpen, Clock, ClockAlert } from 'lucide-react';
import { ReportCard } from '@/components/molecules/shared/ReportCard';

export default function FinancialReportsPage() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  const base = `/${tenantSlug}/accounting/financial-reports`;

  return (
    <div className="flex flex-col gap-6 p-6 min-h-0 overflow-y-auto flex-1">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Financial Reports</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <ReportCard
          icon={<TrendingUp className="w-6 h-6" />}
          iconClassName="bg-blue-600 text-blue-100"
          title="Profit & Loss Statement"
          description="Income and expenditure over a period."
          stats={[
            { label: 'Revenue', value: 'GHS 0.00' },
            { label: 'Expenses', value: 'GHS 0.00' },
            { label: 'Net Profit', value: 'GHS 0.00' },
          ]}
          onClick={() => router.push(`${base}/profit-and-loss`)}
        />

        <ReportCard
          icon={<Scale className="w-6 h-6" />}
          iconClassName="bg-purple-600 text-purple-100"
          title="Balance Sheet"
          description="Financial position at a point in time."
          stats={[
            { label: 'Assets', value: 'GHS 0.00' },
            { label: 'Liabilities', value: 'GHS 0.00' },
            { label: 'Equity', value: 'GHS 0.00' },
          ]}
          onClick={() => router.push(`${base}/balance-sheet`)}
        />

        <ReportCard
          icon={<BookOpen className="w-6 h-6" />}
          iconClassName="bg-emerald-600 text-emerald-100"
          title="Cash Flow Statement"
          description="Shows the inflow and outflow of cash over a period."
          stats={[
            { label: 'Operating Cash Flow', value: 'GHS 0.00' },
            { label: 'Investing Cash Flow', value: 'GHS 0.00' },
            { label: 'Financing Cash Flow', value: 'GHS 0.00' },
          ]}
          onClick={() => router.push(`${base}/cash-flow-statement`)}
        />

        <ReportCard
          icon={<BookOpen className="w-6 h-6" />}
          iconClassName="bg-amber-600 text-amber-100"
          title="Trial Balance"
          description="Lists all account balances to verify debits equal credits."
          stats={[
            { label: 'Total Debit', value: 'GHS 0.00' },
            { label: 'Total Credit', value: 'GHS 0.00' },
          ]}
          onClick={() => router.push(`${base}/trial-balance`)}
        />

        <ReportCard
          icon={<Clock className="w-6 h-6" />}
          iconClassName="bg-cyan-600 text-cyan-100"
          title="Aged Receivable"
          description="Tracks outstanding customer invoices by age."
          stats={[
            { label: 'Current', value: 'GHS 0.00' },
            { label: '30–60 Days', value: 'GHS 0.00' },
            { label: '60+ Days', value: 'GHS 0.00' },
          ]}
          onClick={() => router.push(`${base}/aged-receivable`)}
        />

        <ReportCard
          icon={<ClockAlert className="w-6 h-6" />}
          iconClassName="bg-rose-600 text-rose-100"
          title="Aged Payable"
          description="Tracks outstanding vendor invoices by age."
          stats={[
            { label: 'Current', value: 'GHS 0.00' },
            { label: '30–60 Days', value: 'GHS 0.00' },
            { label: '60+ Days', value: 'GHS 0.00' },
          ]}
          onClick={() => router.push(`${base}/aged-payable`)}
        />
      </div>
    </div>
  );
}
