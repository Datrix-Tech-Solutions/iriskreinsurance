'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { DataTable, type Column } from '@/components/organisms/shared/DataTable';
import { extractError } from '@/lib/extractError';
import { useAgingReport } from '@/hooks';
import type { AccountingAgingCurrencyTotal } from '@/types/accounting';

type AgingRow = AccountingAgingCurrencyTotal & { id: string };

const columns: Column<AgingRow>[] = [
  {
    key: 'currency',
    label: 'Currency',
    render: (row) => <span className="font-medium">{row.currency}</span>,
  },
  ...(['CURRENT', '1_30', '31_60', '61_90', 'OVER_90'] as const).map((bucket) => ({
    key: bucket,
    label:
      bucket === 'CURRENT'
        ? 'Current'
        : bucket === 'OVER_90'
          ? 'Over 90'
          : bucket.replace('_', '–'),
    width: '130px',
    render: (row: AgingRow) => (
      <span className="block text-right">
        {Number(row[bucket]).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </span>
    ),
  })),
];

export function AgingReportView({ side }: { side: 'receivables' | 'payables' }) {
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [generated, setGenerated] = useState(false);
  const { data, isLoading, isError, error } = useAgingReport(side, asOfDate, generated);
  const title = side === 'receivables' ? 'Aged Receivables' : 'Aged Payables';
  return (
    <section className="flex flex-col gap-5">
      <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          As at date
          <input
            className="rounded-lg border border-gray-300 px-3 py-2"
            type="date"
            value={asOfDate}
            onChange={(event) => setAsOfDate(event.target.value)}
          />
        </label>
        <Button onClick={() => setGenerated(true)}>Generate Report</Button>
      </div>
      {!generated ? (
        <p className="py-12 text-center text-sm text-gray-400">
          Choose an as-at date and generate the report.
        </p>
      ) : isError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Unable to load {title.toLowerCase()}: {extractError(error)}
        </p>
      ) : (
        <>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <p className="mt-1 text-sm text-gray-500">
              Outstanding open items by currency and due-date bucket.
            </p>
          </div>
          <DataTable
            columns={columns}
            data={(data?.agingByCurrency ?? []).map((row) => ({ ...row, id: row.currency }))}
            isLoading={isLoading}
            emptyMessage="No open items match this report."
            currentPage={1}
            totalPages={1}
            onPageChange={() => {}}
            noInternalScroll
          />
        </>
      )}
    </section>
  );
}
