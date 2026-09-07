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
  useReinsurerOptions,
  useRiskTypeOptions,
  useCurrencyOptions,
  usePremiumsReport,
} from '@/hooks';
import {
  PremiumReportRow,
  PremiumReinsurerBreakdown,
  PremiumsReportParams,
} from '@/hooks/reinsurance/usePremiumsReport';
import { CedantPaymentStatus } from '@/lib/reinsurance/placementStatus';
import { exportToCsv } from '@/lib/exportCsv';

const PAGE_SIZE = 10;

// Cedant-side premium payment status (has the cedant paid iRisk?).
const PAYMENT_STATUS_OPTIONS: { value: CedantPaymentStatus; label: string }[] = [
  { value: 'Outstanding', label: 'Outstanding' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Part Payment', label: 'Part Payment' },
  { value: 'Paid', label: 'Paid' },
];

// Reinsurer-side settlement status (has iRisk paid the reinsurer their net premium?),
// derived per row from net premium due vs. amount paid.
const SETTLEMENT_OPTIONS: { value: string; label: string }[] = [
  { value: 'paid', label: 'Paid' },
  { value: 'part', label: 'Part Payment' },
  { value: 'outstanding', label: 'Outstanding' },
];

// Same scope filter as the Claims report, minus General — premiums are always
// viewed from either the cedant or the reinsurer side.
type PremiumsReportScope = 'cedant' | 'reinsurer';

const SCOPE_OPTIONS: { value: PremiumsReportScope; label: string }[] = [
  { value: 'cedant', label: 'Cedants' },
  { value: 'reinsurer', label: 'Reinsurer' },
];

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

function fmtPct(value: number | null): string {
  return value == null ? '—' : `${Number(value)}%`;
}

const Muted = ({ children }: { children: React.ReactNode }) => (
  <span className="text-gray-400">{children}</span>
);

interface PremiumReportDisplayRow {
  id: string;
  placementId: string;
  policyNumber: string;
  title: string;
  cedantName: string;
  policyType: string | null;
  offerDate: string | null;
  closedAt: string | null;
  inceptionDate: string | null;
  expiryDate: string | null;
  currency: string | null;
  sumInsured: number | null;
  premium: number | null;
  reinsurerId: string | null;
  reinsurerName: string | null;
  sharePercent: number | null;
  grossPremium: number | null;
  commissionPercent: number | null;
  commissionAmount: number | null;
  netPremium: number | null;
  paidAmount: number | null;
}

function flattenRow(
  r: PremiumReportRow,
  reinsurer: PremiumReinsurerBreakdown | null,
): PremiumReportDisplayRow {
  return {
    id: reinsurer ? `${r.id}:${reinsurer.reinsurerId}` : r.id,
    placementId: r.id,
    policyNumber: r.policyNumber,
    title: r.title,
    cedantName: r.cedantName,
    policyType: r.policyType,
    offerDate: r.offerDate,
    // A specific reinsurer's own closing date when exploded, else the placement's.
    closedAt: reinsurer?.closedAt ?? r.closedAt,
    inceptionDate: r.inceptionDate,
    expiryDate: r.expiryDate,
    currency: r.currency,
    sumInsured: r.sumInsured,
    premium: r.premium,
    reinsurerId: reinsurer?.reinsurerId ?? null,
    reinsurerName: reinsurer?.reinsurerName ?? null,
    // That reinsurer's signed line % when exploded, else the placement's overall offer %.
    sharePercent: reinsurer?.sharePercent ?? r.facultativeOfferPercent,
    grossPremium: reinsurer?.grossPremium ?? null,
    commissionPercent: reinsurer?.commissionPercent ?? null,
    commissionAmount: reinsurer?.commissionAmount ?? null,
    netPremium: reinsurer?.netPremium ?? null,
    paidAmount: reinsurer?.paidAmount ?? null,
  };
}

/* ── columns ──
 * `csv` regenerates the export for whichever scope is active; DataTable ignores it. */
type ReportColumn = Column<PremiumReportDisplayRow> & {
  csv?: (row: PremiumReportDisplayRow) => string | number;
};

const POLICY_NUMBER_COLUMN: ReportColumn = {
  key: 'policyNumber',
  label: 'Policy Number',
  width: '130px',
  render: (row) => <EndorsedReferencePill id={row.placementId} reference={row.policyNumber} />,
  csv: (row) => row.policyNumber,
};

const REINSURER_NAME_COLUMN: ReportColumn = {
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
};

const MIDDLE_COLUMNS: ReportColumn[] = [
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
    key: 'offerDate',
    label: 'Offer Date',
    width: '80px',
    render: (row) => fmtDate(row.offerDate),
    csv: (row) => fmtDate(row.offerDate),
  },
  {
    key: 'dateClosed',
    label: 'Date Closed',
    width: '90px',
    render: (row) => fmtDate(row.closedAt),
    csv: (row) => fmtDate(row.closedAt),
  },
  {
    key: 'periodOfInsurance',
    label: 'Period of Insurance',
    width: '160px',
    render: (row) => fmtPeriod(row.inceptionDate, row.expiryDate),
    csv: (row) => fmtPeriod(row.inceptionDate, row.expiryDate),
  },
  {
    key: 'currency',
    label: 'Currency',
    width: '60px',
    render: (row) => row.currency ?? '—',
    csv: (row) => row.currency ?? '',
  },
  {
    key: 'sumInsured100',
    label: '100% S.I',
    width: '130px',
    className: 'text-right',
    render: (row) => fmtAmount(row.sumInsured, row.currency),
    csv: (row) => row.sumInsured ?? '',
  },
  {
    key: 'premium100',
    label: '100% Premium',
    width: '130px',
    className: 'text-right',
    render: (row) => fmtAmount(row.premium, row.currency),
    csv: (row) => row.premium ?? '',
  },
  {
    key: 'facShare',
    label: 'Fac Share',
    width: '60px',
    className: 'text-right',
    render: (row) => fmtPct(row.sharePercent),
    csv: (row) => row.sharePercent ?? '',
  },
];

const CEDANT_TAIL_COLUMNS: ReportColumn[] = [
  {
    key: 'netPremiumDueReinsurer',
    label: 'Net Premium Due Reinsurer',
    width: '140px',
    className: 'text-right',
    render: (row) => fmtAmount(row.netPremium, row.currency),
    csv: (row) => row.netPremium ?? '',
  },
  {
    key: 'netPremiumDueReinsurerPaid',
    label: 'Net Premium Due Reinsurer Paid',
    width: '160px',
    className: 'text-right',
    render: (row) => fmtAmount(row.paidAmount, row.currency),
    csv: (row) => row.paidAmount ?? '',
  },
];

const REINSURER_TAIL_COLUMNS: ReportColumn[] = [
  {
    key: 'facPremium',
    label: 'Fac Premium',
    width: '140px',
    className: 'text-right',
    render: (row) => fmtAmount(row.grossPremium, row.currency),
    csv: (row) => row.grossPremium ?? '',
  },
  {
    key: 'commissionPct',
    label: "Insurer's Commission %",
    width: '120px',
    className: 'text-right',
    render: (row) => fmtPct(row.commissionPercent),
    csv: (row) => row.commissionPercent ?? '',
  },
  {
    key: 'commissionAmount',
    label: "Insurer's Commission Amount",
    width: '140px',
    className: 'text-right',
    render: (row) => fmtAmount(row.commissionAmount, row.currency),
    csv: (row) => row.commissionAmount ?? '',
  },
  {
    key: 'netPremiumDueIriskRe',
    label: 'Net Premium Due iRisk Re',
    width: '150px',
    className: 'text-right',
    render: (row) => fmtAmount(row.netPremium, row.currency),
    csv: (row) => row.netPremium ?? '',
  },
  {
    key: 'netPremiumDueIriskRePaid',
    label: 'Net Premium Due iRisk Re Paid',
    width: '170px',
    className: 'text-right',
    render: (row) => fmtAmount(row.paidAmount, row.currency),
    csv: (row) => row.paidAmount ?? '',
  },
];

const COLUMNS_BY_SCOPE: Record<PremiumsReportScope, ReportColumn[]> = {
  cedant: [POLICY_NUMBER_COLUMN, REINSURER_NAME_COLUMN, ...MIDDLE_COLUMNS, ...CEDANT_TAIL_COLUMNS],
  reinsurer: [POLICY_NUMBER_COLUMN, ...MIDDLE_COLUMNS, ...REINSURER_TAIL_COLUMNS],
};

export function PremiumsReportTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [page, setPage] = useState(1);

  // Staged filter values — only applied to the report once "Run Filter" is clicked.
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [riskTypeId, setRiskTypeId] = useState('');
  const [currency, setCurrency] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [settlement, setSettlement] = useState('');
  const [scope, setScope] = useState<PremiumsReportScope>('cedant');
  const [cedantIds, setCedantIds] = useState<string[]>([]);
  const [reinsurerIds, setReinsurerIds] = useState<string[]>([]);
  const [reportParams, setReportParams] = useState<PremiumsReportParams | null>(null);

  const { options: cedantOptions } = useCedantOptions();
  const { options: reinsurerOptions } = useReinsurerOptions();
  const { data: riskTypeOptions = [] } = useRiskTypeOptions();
  const { data: currencyOptions = [] } = useCurrencyOptions();

  const handleScopeChange = (value: string) => {
    setScope(value as PremiumsReportScope);
    setCedantIds([]);
    setReinsurerIds([]);
    setPage(1);
  };

  const { rows, isLoading } = usePremiumsReport(reportParams ?? {}, {
    enabled: reportParams !== null,
  });

  const handleRunFilter = () => {
    setReportParams({
      startDate,
      endDate,
      riskTypeId: riskTypeId || undefined,
      currency: currency || undefined,
      paymentStatus: (paymentStatus || undefined) as CedantPaymentStatus | undefined,
      cedantIds: scope === 'cedant' && cedantIds.length ? cedantIds : undefined,
    });
    setPage(1);
  };

  // Column set depends on scope — Cedants adds the Reinsurer name column and the
  // reinsurer-payable tail; Reinsurer swaps that tail for the commission/net-premium block.
  const columns = useMemo<ReportColumn[]>(() => COLUMNS_BY_SCOPE[scope], [scope]);

  // Explode per confirmed reinsurer closing (both scopes), then narrow to the
  // selected reinsurers when Scope = Reinsurer, then by settlement status.
  const displayRows = useMemo<PremiumReportDisplayRow[]>(() => {
    let flat = rows.flatMap((r) =>
      r.reinsurers.length ? r.reinsurers.map((re) => flattenRow(r, re)) : [flattenRow(r, null)],
    );

    if (scope === 'reinsurer' && reinsurerIds.length) {
      const selected = new Set(reinsurerIds);
      flat = flat.filter((row) => row.reinsurerId != null && selected.has(row.reinsurerId));
    }

    if (settlement) {
      flat = flat.filter((row) => {
        const net = row.netPremium ?? 0;
        const paid = row.paidAmount ?? 0;
        if (settlement === 'paid') return net > 0.01 && paid >= net - 0.01;
        if (settlement === 'outstanding') return paid <= 0.01;
        return paid > 0.01 && paid < net - 0.01; // part payment
      });
    }
    return flat;
  }, [rows, scope, reinsurerIds, settlement]);

  const totalPages = Math.max(1, Math.ceil(displayRows.length / PAGE_SIZE));
  const paged = displayRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExport = () => {
    const headers = columns.map((c) => c.label);
    const data = displayRows.map((row) => columns.map((c) => c.csv?.(row) ?? ''));
    exportToCsv(`premiums-report-${new Date().toISOString().slice(0, 10)}.csv`, headers, data);
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
              <div className="w-36">
                <SearchSelect
                  size="sm"
                  showAllOption
                  placeholder="Status"
                  options={PAYMENT_STATUS_OPTIONS}
                  value={paymentStatus}
                  onChange={setPaymentStatus}
                />
              </div>
              <div className="w-40">
                <SearchSelect
                  size="sm"
                  showAllOption
                  placeholder="Settlement"
                  options={SETTLEMENT_OPTIONS}
                  value={settlement}
                  onChange={(value) => {
                    setSettlement(value);
                    setPage(1);
                  }}
                />
              </div>
              <div className="w-36">
                <SearchSelect
                  size="sm"
                  placeholder="Scope"
                  options={SCOPE_OPTIONS}
                  value={scope}
                  onChange={handleScopeChange}
                />
              </div>
              {scope === 'cedant' && (
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
              )}
              {scope === 'reinsurer' && (
                <div className="w-44">
                  <MultiSelect
                    size="sm"
                    variant="inline"
                    placeholder="Reinsurers"
                    options={reinsurerOptions}
                    value={reinsurerIds}
                    onChange={(next) => {
                      setReinsurerIds(next);
                      setPage(1);
                    }}
                  />
                </div>
              )}
            </div>
          }
          actionButton={{
            label: 'Run Filter',
            onClick: handleRunFilter,
            disabled: !startDate || !endDate,
          }}
          emptyMessage={
            reportParams
              ? 'No premium activity for the selected filters'
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
