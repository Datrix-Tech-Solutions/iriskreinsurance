'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { EndorsedReferencePill } from '@/components/atoms/EndorsedReferencePill';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import {
  useCedantOptions,
  useRiskTypeOptions,
  useCurrencyOptions,
  useBrokerageReport,
} from '@/hooks';
import {
  BrokerageReportRow,
  BrokerageReinsurerRow,
  BrokerageReportParams,
} from '@/hooks/reinsurance/useBrokerageReport';
import { exportToCsv } from '@/lib/exportCsv';

const PAGE_SIZE = 10;

// Brokerage is always viewed from the cedant side and only accrues on premium that
// has been paid — so unlike the Premiums report there's no scope selector, and no
// cedant payment-status / reinsurer settlement filters.

/* ── formatting ── */

function fmtAmount(value: number | null, currency: string | null): string {
  if (value == null) return '—';
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${currency} ${formatted}` : formatted;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return '—';
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}

const Muted = ({ children }: { children: React.ReactNode }) => (
  <span className="text-gray-400">{children}</span>
);

function fmtRate(value: number | null): string {
  return value == null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

/* ── display row ──
 * One row per confirmed reinsurer closing (shared placement cells repeated).
 * Brokerage / WHT / NIC come from the reinsurer's credit note; the "*Paid"
 * figures are those amounts pro-rated by how much premium has been collected. */
interface BrokerageReportDisplayRow {
  id: string;
  placementId: string;
  policyNumber: string;
  title: string;
  cedantName: string;
  policyType: string | null;
  inceptionDate: string | null;
  expiryDate: string | null;
  currency: string | null;
  sumInsured: number | null;
  premium: number | null;
  exchangeRate: number | null;
  reinsurerName: string | null;
  grossPremium: number | null;
  brokerageAmount: number | null;
  brokeragePaid: number | null;
  withholdingTax: number | null;
  withholdingTaxPaid: number | null;
  nicLevy: number | null;
  nicLevyPaid: number | null;
}

function flattenRow(
  r: BrokerageReportRow,
  reinsurer: BrokerageReinsurerRow | null,
): BrokerageReportDisplayRow {
  return {
    id: reinsurer ? `${r.id}:${reinsurer.reinsurerId}` : r.id,
    placementId: r.id,
    policyNumber: r.policyNumber,
    title: r.title,
    cedantName: r.cedantName,
    policyType: r.policyType,
    inceptionDate: r.inceptionDate,
    expiryDate: r.expiryDate,
    currency: r.currency,
    sumInsured: r.sumInsured,
    premium: r.premium,
    exchangeRate: r.exchangeRate,
    reinsurerName: reinsurer?.reinsurerName ?? null,
    grossPremium: reinsurer?.grossPremium ?? null,
    brokerageAmount: reinsurer?.brokerageAmount ?? null,
    brokeragePaid: reinsurer?.brokeragePaid ?? null,
    withholdingTax: reinsurer?.withholdingTax ?? null,
    withholdingTaxPaid: reinsurer?.withholdingTaxPaid ?? null,
    nicLevy: reinsurer?.nicLevy ?? null,
    nicLevyPaid: reinsurer?.nicLevyPaid ?? null,
  };
}

/* ── columns ── */
type ReportColumn = Column<BrokerageReportDisplayRow> & {
  csv?: (row: BrokerageReportDisplayRow) => string | number;
};

const COLUMNS: ReportColumn[] = [
  {
    key: 'policyNumber',
    label: 'Policy Number',
    width: '130px',
    render: (row) => <EndorsedReferencePill id={row.placementId} reference={row.policyNumber} />,
    csv: (row) => row.policyNumber,
  },
  {
    key: 'reinsurerName',
    label: 'Reinsurer',
    width: '150px',
    render: (row) =>
      row.reinsurerName ? (
        <span className="text-gray-700">{row.reinsurerName}</span>
      ) : (
        <Muted>—</Muted>
      ),
    csv: (row) => row.reinsurerName ?? '',
  },
  {
    key: 'insured',
    label: 'Insured',
    width: 'minmax(140px, 1fr)',
    render: (row) => <span className="text-gray-700">{row.title}</span>,
    csv: (row) => row.title,
  },
  {
    key: 'policyType',
    label: 'Policy Type',
    width: '120px',
    render: (row) => row.policyType ?? <Muted>—</Muted>,
    csv: (row) => row.policyType ?? '',
  },
  {
    key: 'cedantName',
    label: 'Cedants',
    width: 'minmax(120px, 1fr)',
    render: (row) => <span className="text-gray-700">{row.cedantName}</span>,
    csv: (row) => row.cedantName,
  },
  {
    key: 'periodOfInsurance',
    label: 'Period of Insurance',
    width: '190px',
    render: (row) => fmtPeriod(row.inceptionDate, row.expiryDate),
    csv: (row) => fmtPeriod(row.inceptionDate, row.expiryDate),
  },
  {
    key: 'currency',
    label: 'Currency',
    width: '80px',
    render: (row) => row.currency ?? '—',
    csv: (row) => row.currency ?? '',
  },
  {
    key: 'sumInsured100',
    label: '100% S.I',
    width: '140px',
    className: 'text-right',
    render: (row) => fmtAmount(row.sumInsured, row.currency),
    csv: (row) => row.sumInsured ?? '',
  },
  {
    key: 'premium100',
    label: '100% Premium',
    width: '140px',
    className: 'text-right',
    render: (row) => fmtAmount(row.premium, row.currency),
    csv: (row) => row.premium ?? '',
  },
  {
    key: 'facPremium',
    label: 'Fac Premium',
    width: '140px',
    className: 'text-right',
    render: (row) => fmtAmount(row.grossPremium, row.currency),
    csv: (row) => row.grossPremium ?? '',
  },
  {
    key: 'exchangeRate',
    label: 'Exchange Rate',
    width: '110px',
    className: 'text-right',
    render: (row) => fmtRate(row.exchangeRate),
    csv: (row) => row.exchangeRate ?? '',
  },
  {
    key: 'brokerageAmount',
    label: 'Full Brokerage Amount',
    width: '160px',
    className: 'text-right',
    render: (row) => fmtAmount(row.brokerageAmount, row.currency),
    csv: (row) => row.brokerageAmount ?? '',
  },
  {
    key: 'brokeragePaid',
    label: 'Brokerage Paid',
    width: '140px',
    className: 'text-right',
    render: (row) => fmtAmount(row.brokeragePaid, row.currency),
    csv: (row) => row.brokeragePaid ?? '',
  },
  {
    key: 'wht',
    label: 'WHT',
    width: '120px',
    className: 'text-right',
    render: (row) => fmtAmount(row.withholdingTax, row.currency),
    csv: (row) => row.withholdingTax ?? '',
  },
  {
    key: 'whtPaid',
    label: 'WHT Paid',
    width: '120px',
    className: 'text-right',
    render: (row) => fmtAmount(row.withholdingTaxPaid, row.currency),
    csv: (row) => row.withholdingTaxPaid ?? '',
  },
  {
    key: 'nicLevy',
    label: 'NIC Levy',
    width: '120px',
    className: 'text-right',
    render: (row) => fmtAmount(row.nicLevy, row.currency),
    csv: (row) => row.nicLevy ?? '',
  },
  {
    key: 'nicLevyPaid',
    label: 'NIC Levy Paid',
    width: '130px',
    className: 'text-right',
    render: (row) => fmtAmount(row.nicLevyPaid, row.currency),
    csv: (row) => row.nicLevyPaid ?? '',
  },
];

export function BrokerageReportTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [page, setPage] = useState(1);

  // Staged filter values — only applied to the report once "Run Filter" is clicked.
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [riskTypeId, setRiskTypeId] = useState('');
  const [currency, setCurrency] = useState('');
  const [cedantIds, setCedantIds] = useState<string[]>([]);
  const [reportParams, setReportParams] = useState<BrokerageReportParams | null>(null);

  const { options: cedantOptions } = useCedantOptions();
  const { data: riskTypeOptions = [] } = useRiskTypeOptions();
  const { data: currencyOptions = [] } = useCurrencyOptions();

  const { rows, isLoading } = useBrokerageReport(reportParams ?? {}, {
    enabled: reportParams !== null,
  });

  const handleRunFilter = () => {
    setReportParams({
      startDate,
      endDate,
      riskTypeId: riskTypeId || undefined,
      currency: currency || undefined,
      cedantIds: cedantIds.length ? cedantIds : undefined,
    });
    setPage(1);
  };

  const columns = useMemo<ReportColumn[]>(() => COLUMNS, []);

  // Explode per confirmed reinsurer closing (shared placement cells repeated).
  const displayRows = useMemo<BrokerageReportDisplayRow[]>(
    () =>
      rows.flatMap((r) =>
        r.reinsurers.length ? r.reinsurers.map((re) => flattenRow(r, re)) : [flattenRow(r, null)],
      ),
    [rows],
  );

  const totalPages = Math.max(1, Math.ceil(displayRows.length / PAGE_SIZE));
  const paged = displayRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExport = () => {
    const headers = columns.map((c) => c.label);
    const data = displayRows.map((row) => columns.map((c) => c.csv?.(row) ?? ''));
    exportToCsv(`brokerage-report-${new Date().toISOString().slice(0, 10)}.csv`, headers, data);
  };

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <div className="flex-1 min-h-0">
        <DataTable
          columns={columns}
          data={paged}
          isLoading={reportParams !== null && isLoading}
          onRowClick={(row) =>
            router.push(`/${tenantSlug}/operations/reinsurance/payments/${row.placementId}`)
          }
          onExport={reportParams && displayRows.length > 0 ? handleExport : undefined}
          extraFilters={
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-50">
                <DatePicker
                  size="sm"
                  placeholder="Period start"
                  value={startDate}
                  onChange={setStartDate}
                />
              </div>
              <div className="w-50">
                <DatePicker
                  size="sm"
                  placeholder="Period end"
                  value={endDate}
                  minDate={startDate || undefined}
                  onChange={setEndDate}
                />
              </div>
              <div className="w-36">
                <SearchSelect
                  size="sm"
                  showAllOption
                  placeholder="Risk type"
                  options={riskTypeOptions}
                  value={riskTypeId}
                  onChange={setRiskTypeId}
                />
              </div>
              <div className="w-32">
                <SearchSelect
                  size="sm"
                  showAllOption
                  placeholder="Currency"
                  options={currencyOptions}
                  value={currency}
                  onChange={setCurrency}
                />
              </div>
              <div className="w-44">
                <MultiSelect
                  size="sm"
                  variant="inline"
                  placeholder="Cedants"
                  options={cedantOptions}
                  value={cedantIds}
                  onChange={setCedantIds}
                />
              </div>
            </div>
          }
          actionButton={{
            label: 'Run Filter',
            onClick: handleRunFilter,
            disabled: !startDate || !endDate,
          }}
          emptyMessage={
            reportParams
              ? 'No brokerage activity for the selected filters'
              : 'Select a period and click Run Filter to generate the report'
          }
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          noInternalScroll
        />
      </div>
    </div>
  );
}
