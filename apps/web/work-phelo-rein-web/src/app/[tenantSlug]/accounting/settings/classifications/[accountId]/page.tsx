'use client';

import { use } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { ClassificationOverview } from '@/components/molecules/accounting/ClassificationOverview';
import { AccountTransactionsTable } from '@/components/organisms/accounting/tables/AccountTransactionsTable';
import { useAccountClassification } from '@/hooks';

export default function ClassificationDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; accountId: string }>;
}) {
  const { tenantSlug, accountId } = use(params);

  const { data: account, isLoading } = useAccountClassification(accountId);
  const base = `/${tenantSlug}/accounting/settings/classifications`;

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href={base} className="hover:text-gray-700 transition-colors">
          Classifications
        </Link>
        <Icons.ChevronRight className="w-5 h-5" />
        <span className="text-gray-700 font-medium">{account?.name ?? '—'}</span>
      </nav>

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>
      ) : !account ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">
          Account not found.
        </div>
      ) : (
        <>
          <ClassificationOverview account={account} />
          <AccountTransactionsTable />
        </>
      )}
    </div>
  );
}
