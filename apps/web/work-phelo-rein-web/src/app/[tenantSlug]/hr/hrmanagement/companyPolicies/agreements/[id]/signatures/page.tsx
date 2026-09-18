'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { useCompanyAgreementSignatures } from '@/hooks';
import { cn } from '@/lib/utils';
import type { CompanyAgreementSignatureRow } from '@/types/hr';

const STATUS_LABEL: Record<string, string> = {
  SIGNED: 'Signed',
  DECLINED: 'Declined',
  PENDING: 'Pending',
  REVOKED: 'Revoked',
};

const STATUS_CLASS: Record<string, string> = {
  SIGNED: 'bg-green-100 text-green-700',
  DECLINED: 'bg-red-100 text-red-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  REVOKED: 'bg-gray-100 text-gray-500',
};

type SignatureRow = CompanyAgreementSignatureRow & { id: string };

const COLUMNS: Column<SignatureRow>[] = [
  {
    key: 'name',
    label: 'Employee',
    render: (row) => (
      <span className="font-medium text-gray-900">
        {row.employee.firstName} {row.employee.lastName}
      </span>
    ),
  },
  {
    key: 'department',
    label: 'Department',
    render: (row) => row.employee.department?.name ?? '—',
  },
  {
    key: 'status',
    label: 'Status',
    render: (row) => (
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
          STATUS_CLASS[row.status] ?? STATUS_CLASS.PENDING,
        )}
      >
        {STATUS_LABEL[row.status] ?? row.status}
      </span>
    ),
  },
  {
    key: 'signedAt',
    label: 'Time Signed',
    render: (row) => {
      const at = row.signature?.signedAt ?? row.signature?.declinedAt;
      if (!at) return <span className="text-gray-400">—</span>;
      return new Date(at).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    },
  },
];

export default function AgreementSignaturesPage() {
  const { tenantSlug, id } = useParams<{ tenantSlug: string; id: string }>();
  const { data, isLoading } = useCompanyAgreementSignatures(id);

  const agreementsHref = `/${tenantSlug}/hr/hrmanagement/companyPolicies/agreements`;
  const agreementTitle = data?.agreement?.title ?? 'Agreement';
  const rows: SignatureRow[] = (data?.rows ?? []).map((r) => ({ ...r, id: r.employee.id }));

  return (
    <div className="flex flex-col gap-6">
      <nav className="shrink-0 flex items-center gap-2 text-sm text-gray-400">
        <Link href={agreementsHref} className="hover:text-gray-700 transition-colors">
          Company Agreements
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-700 font-medium">{agreementTitle}</span>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-700 font-medium">Signatures</span>
      </nav>

      <DataTable
        columns={COLUMNS}
        data={rows}
        isLoading={isLoading}
        emptyMessage="No employees found"
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        noInternalScroll
      />
    </div>
  );
}
