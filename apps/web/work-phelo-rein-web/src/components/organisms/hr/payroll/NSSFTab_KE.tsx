// 'use client';

import { useState, useMemo } from 'react';
import { Download, User, Building2, Wallet, Receipt } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { Column, DataTable } from '../../shared/DataTable';
import { usePayrollRuns, usePayrollRun, useAllEmployees } from '@/hooks';
import { PayrollItem } from '@/types/hr';
import { payrollMonthLabel } from '@/lib/payrollUtils';

const NSSF_RATE = 0.06;

function fmt(n: number) {
  return `KES ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface NSSFRow {
  id: string;
  employeeId: string;
  name: string;
  employeeNumber: string;
  nssfNumber?: string;
  basicSalary: number;
  employeeNSSF: number;
  employerNSSF: number;
  totalNSSF: number;
  payeTax: number;
}

function buildRows(items: PayrollItem[], nssfMap: Record<string, string>): NSSFRow[] {
  return items.map((item) => {
    const basic = parseFloat(item.basicSalary);
    const employeeNSSF = parseFloat(item.employeeSSNIT);
    const employerNSSF = parseFloat(item.employerSSNIT);
    return {
      id: item.id,
      employeeId: item.employeeId,
      name: item.employee ? `${item.employee.firstName} ${item.employee.lastName}` : '—',
      employeeNumber: item.employee?.employeeNumber ?? '—',
      nssfNumber: nssfMap[item.employeeId],
      basicSalary: basic,
      employeeNSSF,
      employerNSSF,
      totalNSSF: employeeNSSF + employerNSSF,
      payeTax: parseFloat(item.payeTax),
    };
  });
}

export function NSSFTab_KE() {
  const { data: runs = [], isLoading: runsLoading } = usePayrollRuns();
  const { data: empData } = useAllEmployees();
  const [selectedRunId, setSelectedRunId] = useState('');

  const availableRuns = useMemo(
    () =>
      runs
        .filter((r) => r.status !== 'DRAFT')
        .sort((a, b) => (b.year !== a.year ? b.year - a.year : b.month - a.month)),
    [runs],
  );

  const runId = selectedRunId || availableRuns[0]?.id || '';
  const { data: runDetail, isLoading: detailLoading } = usePayrollRun(runId);

  const nssfMap = useMemo(() => {
    const map: Record<string, string> = {};
    (empData?.data ?? []).forEach((e) => {
      if (e.ssnit) map[e.id] = e.ssnit;
    });
    return map;
  }, [empData]);

  const rows = useMemo(
    () => (runDetail?.items ? buildRows(runDetail.items, nssfMap) : []),
    [runDetail, nssfMap],
  );

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          employeeNSSF: acc.employeeNSSF + r.employeeNSSF,
          employerNSSF: acc.employerNSSF + r.employerNSSF,
          totalNSSF: acc.totalNSSF + r.totalNSSF,
          payeTax: acc.payeTax + r.payeTax,
        }),
        { employeeNSSF: 0, employerNSSF: 0, totalNSSF: 0, payeTax: 0 },
      ),
    [rows],
  );

  const handleExport = () => {
    const run = availableRuns.find((r) => r.id === runId);
    const headers = [
      'Employee',
      'Employee Number',
      'NSSF Number',
      'Basic Salary',
      `Employee NSSF (${NSSF_RATE * 100}%)`,
      `Employer NSSF (${NSSF_RATE * 100}%)`,
      'Total NSSF Remittable (12%)',
      'PAYE Tax',
    ];
    const csvRows = rows.map((r) => [
      r.name,
      r.employeeNumber,
      r.nssfNumber ?? '',
      r.basicSalary.toFixed(2),
      r.employeeNSSF.toFixed(2),
      r.employerNSSF.toFixed(2),
      r.totalNSSF.toFixed(2),
      r.payeTax.toFixed(2),
    ]);
    const csv = [headers, ...csvRows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nssf-${run ? payrollMonthLabel(run.month, run.year).replace(' ', '-') : 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns: Column<NSSFRow>[] = [
    {
      key: 'employee',
      label: 'Employee',
      width: 'minmax(200px, 1.5fr)',
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900">{row.name}</p>
          <p className="text-xs text-gray-400">{row.employeeNumber}</p>
        </div>
      ),
    },
    {
      key: 'nssfNumber',
      label: 'NSSF Number',
      width: 'minmax(150px, 1.5fr)',
      render: (row) =>
        row.nssfNumber ? (
          <span className="font-mono text-sm text-gray-700">{row.nssfNumber}</span>
        ) : (
          <span className="text-xs text-gray-400 italic">Not set</span>
        ),
    },
    {
      key: 'basicSalary',
      label: 'Basic Salary',
      width: '100px',
      render: (row) => fmt(row.basicSalary),
    },
    {
      key: 'employeeNSSF',
      label: `Employee (${NSSF_RATE * 100}%)`,
      width: '100px',
      render: (row) => fmt(row.employeeNSSF),
    },
    {
      key: 'employerNSSF',
      label: `Employer (${NSSF_RATE * 100}%)`,
      width: '100px',
      render: (row) => fmt(row.employerNSSF),
    },
    {
      key: 'totalNSSF',
      label: 'Total Remittable (12%)',
      width: '100px',
      render: (row) => <span className="font-semibold text-gray-900">{fmt(row.totalNSSF)}</span>,
    },
    {
      key: 'payeTax',
      label: 'PAYE Tax',
      width: '100px',
      render: (row) => fmt(row.payeTax),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between shrink-0">
        <div className="w-64">
          <SearchSelect
            placeholder="Select payroll run…"
            options={availableRuns.map<SearchSelectOption>((r) => ({
              value: r.id,
              label: payrollMonthLabel(r.month, r.year),
              sublabel: fmtStatus(r.status),
            }))}
            value={selectedRunId || runId}
            onChange={(v) => setSelectedRunId(v)}
          />
        </div>

        <Button variant="outline" onClick={handleExport} disabled={!runId || rows.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
        <KpiCard
          label={`Employee NSSF (${NSSF_RATE * 100}%)`}
          value={fmt(totals.employeeNSSF)}
          icon={User}
          iconColor="#6b7280"
        />
        <KpiCard
          label={`Employer NSSF (${NSSF_RATE * 100}%)`}
          value={fmt(totals.employerNSSF)}
          icon={Building2}
          iconColor="#2a78d6"
        />
        <KpiCard
          label="Total Remittable (12%)"
          value={fmt(totals.totalNSSF)}
          icon={Wallet}
          iconColor="#1baf7a"
        />
        <KpiCard
          label="Total PAYE"
          value={fmt(totals.payeTax)}
          icon={Receipt}
          iconColor="#eda100"
        />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={runsLoading || detailLoading}
        emptyMessage={
          availableRuns.length === 0
            ? 'No completed payroll runs yet'
            : 'No payroll items for this run'
        }
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        noInternalScroll
      />
    </div>
  );
}
