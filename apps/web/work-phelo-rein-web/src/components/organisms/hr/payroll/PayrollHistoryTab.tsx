'use client';

import { useState, useRef, useMemo } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { useQueryClient } from '@tanstack/react-query';
import { TableButton } from '@/components/atoms/TableButton';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Column, DataTable } from '../../shared/DataTable';
import { PayrollRun, PayrollRunDetail } from '@/types/hr';
import { usePayrollRuns } from '@/hooks';
import { useTenantConfig } from '@/hooks/useTenantConfig';
import {
  payrollMonthLabel,
  downloadPayrollBankFormat,
  downloadPayrollFullFormat,
  downloadPayrollPDFFormat,
  MONTH_OPTIONS,
} from '@/lib/payrollUtils';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatPayrollMoney, getPayrollLabels } from '@/lib/payrollDisplay';

function DownloadMenu({ run }: { run: PayrollRun }) {
  const isPaid = run.status === 'PAID';
  const [open, setOpen] = useState(false);
  const [pendingFormat, setPendingFormat] = useState<'bank' | 'full' | null>(null);
  const [loading, setLoading] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, bottom: 0, right: 0 });
  const [openUpward, setOpenUpward] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();
  const companyName = useAuthStore((s) => s.user?.tenantName ?? '');
  const label = payrollMonthLabel(run.month, run.year).replace(' ', '-');

  const closeAll = () => {
    setOpen(false);
    setPendingFormat(null);
  };

  const handleOpen = () => {
    if (loading || !isPaid) return;
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setOpenUpward(window.innerHeight - rect.bottom < 120);
      setMenuPos({
        top: rect.bottom + 4,
        bottom: window.innerHeight - rect.top + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen((v) => !v);
    setPendingFormat(null);
  };

  const fetchDetail = () =>
    queryClient.fetchQuery({
      queryKey: ['payroll', run.id],
      queryFn: async () => {
        const res = await api.get<PayrollRunDetail>(`/hr/payroll/${run.id}`);
        return res.data;
      },
    });

  const handleFileType = async (type: 'csv' | 'pdf') => {
    const format = pendingFormat!;
    closeAll();
    setLoading(true);
    try {
      const detail = await fetchDetail();
      if (type === 'csv') {
        if (format === 'bank') downloadPayrollBankFormat(detail, label, companyName);
        else downloadPayrollFullFormat(detail, label, companyName);
      } else {
        await downloadPayrollPDFFormat(detail, label, format, companyName);
      }
    } finally {
      setLoading(false);
    }
  };

  const dropdownVisible = open || !!pendingFormat;

  return (
    <div>
      <button
        ref={buttonRef}
        onClick={handleOpen}
        disabled={!isPaid}
        title={isPaid ? 'Download' : 'Mark as paid to download'}
        className={`p-1.5 rounded-lg transition-colors ${
          isPaid
            ? 'text-green-600 hover:text-green-700 hover:bg-green-50'
            : 'text-gray-200 cursor-not-allowed'
        }`}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      </button>

      {dropdownVisible && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeAll} />
          <div
            style={{
              position: 'fixed',
              right: menuPos.right,
              ...(openUpward ? { bottom: menuPos.bottom } : { top: menuPos.top }),
              minWidth: 176,
            }}
            className="z-50 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden"
          >
            {open && (
              <>
                <button
                  onClick={() => {
                    setOpen(false);
                    setPendingFormat('bank');
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Bank format
                </button>
                <button
                  onClick={() => {
                    setOpen(false);
                    setPendingFormat('full');
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Full format
                </button>
              </>
            )}
            {pendingFormat && (
              <>
                <p className="px-4 pt-3 pb-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  {pendingFormat === 'bank' ? 'Bank format' : 'Full format'}
                </p>
                <button
                  onClick={() => handleFileType('csv')}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  CSV
                </button>
                <button
                  onClick={() => handleFileType('pdf')}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  PDF
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Paid', value: 'PAID' },
];

export function PayrollHistoryTab() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const { data: runs = [], isLoading } = usePayrollRuns();
  useTenantConfig();

  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(1);

  const yearOptions = useMemo(() => {
    const years = Array.from(
      new Set(
        runs.filter((r) => r.status === 'APPROVED' || r.status === 'PAID').map((r) => r.year),
      ),
    ).sort((a, b) => b - a);
    return years.map((y) => ({ value: String(y), label: String(y) }));
  }, [runs]);

  const history = useMemo(() => {
    let result = runs.filter((r) => r.status === 'APPROVED' || r.status === 'PAID');

    if (statusFilter) result = result.filter((r) => r.status === statusFilter);
    if (monthFilter) result = result.filter((r) => r.month === Number(monthFilter));
    if (yearFilter) result = result.filter((r) => r.year === Number(yearFilter));

    return [...result].sort((a, b) => {
      const aVal = a.year * 12 + a.month;
      const bVal = b.year * 12 + b.month;
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [runs, monthFilter, yearFilter, statusFilter, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
  const paged = history.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<PayrollRun>[] = [
    {
      key: 'month',
      label: 'Month',
      width: 'minmax(200px, 1fr)',
      render: (row) => (
        <span className="font-medium text-gray-900">{payrollMonthLabel(row.month, row.year)}</span>
      ),
    },
    {
      key: 'totalGross',
      label: 'Total Gross',
      width: '100px',
      render: (row) => formatPayrollMoney(row.totalGross, row.payrollCurrency, row.payrollCountry),
    },
    {
      key: 'totalNet',
      label: 'Total Net Pay',
      width: '100px',
      render: (row) => formatPayrollMoney(row.totalNet, row.payrollCurrency, row.payrollCountry),
    },
    {
      key: 'totalPAYE',
      label: 'Total PAYE',
      width: '100px',
      render: (row) => formatPayrollMoney(row.totalPAYE, row.payrollCurrency, row.payrollCountry),
    },
    {
      key: 'totalSSNIT',
      label: 'Statutory',
      width: '100px',
      render: (row) => (
        <span title={getPayrollLabels(row.payrollCountry).totalLabel}>
          {formatPayrollMoney(row.totalSSNIT, row.payrollCurrency, row.payrollCountry)}
        </span>
      ),
    },
    {
      key: 'totalEmployerCost',
      label: 'Total Employer Cost',
      width: '150px',
      render: (row) =>
        formatPayrollMoney(row.totalEmployerCost, row.payrollCurrency, row.payrollCountry),
    },
    {
      key: 'status',
      label: 'Status',
      width: '100px',
      render: (row) => {
        const isPaid = row.status === 'PAID';
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              isPaid ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
            }`}
          >
            {isPaid ? 'Paid' : 'Approved'}
          </span>
        );
      },
    },
    {
      key: 'actions',
      label: '',
      width: '100px',
      render: (row) => (
        <div className="flex items-center gap-1">
          <TableButton
            variant="blue"
            onClick={() => router.push(`/${params.tenantSlug}/hr/payroll/history/${row.id}`)}
          >
            View
          </TableButton>
          <DownloadMenu run={row} />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col">
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/${params.tenantSlug}/hr/payroll/history/${row.id}`)}
        emptyMessage="No payroll history found"
        extraFilters={
          <>
            <div className="w-40">
              <SearchSelect
                placeholder="Month"
                size="sm"
                options={MONTH_OPTIONS}
                value={monthFilter}
                onChange={(val) => {
                  setMonthFilter(val);
                  setPage(1);
                }}
              />
            </div>
            <div className="w-32">
              <SearchSelect
                placeholder="Year"
                size="sm"
                options={yearOptions}
                value={yearFilter}
                onChange={(val) => {
                  setYearFilter(val);
                  setPage(1);
                }}
              />
            </div>
            <div className="w-32">
              <SearchSelect
                placeholder="Status"
                size="sm"
                options={STATUS_OPTIONS}
                value={statusFilter}
                onChange={(val) => {
                  setStatusFilter(val);
                  setPage(1);
                }}
              />
            </div>
          </>
        }
        secondaryButton={{
          label: sortOrder === 'desc' ? '↓ Newest First' : '↑ Oldest First',
          onClick: () => {
            setSortOrder((s) => (s === 'desc' ? 'asc' : 'desc'));
            setPage(1);
          },
        }}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />
    </div>
  );
}
