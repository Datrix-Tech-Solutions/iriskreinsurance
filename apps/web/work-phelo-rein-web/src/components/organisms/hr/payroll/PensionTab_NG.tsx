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

const EMPLOYEE_RATE = 0.08;
const EMPLOYER_RATE = 0.1;

function fmt(n: number) {
  return `NGN ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface PensionRow {
  id: string;
  employeeId: string;
  name: string;
  employeeNumber: string;
  pensionNumber?: string;
  basicSalary: number;
  employeePension: number;
  employerPension: number;
  totalPension: number;
  payeTax: number;
}

function buildRows(items: PayrollItem[], pensionMap: Record<string, string>): PensionRow[] {
  return items.map((item) => {
    const basic = parseFloat(item.basicSalary);
    const employeePension = parseFloat(item.employeeSSNIT);
    const employerPension = parseFloat(item.employerSSNIT);
    return {
      id: item.id,
      employeeId: item.employeeId,
      name: item.employee ? `${item.employee.firstName} ${item.employee.lastName}` : '—',
      employeeNumber: item.employee?.employeeNumber ?? '—',
      pensionNumber: pensionMap[item.employeeId],
      basicSalary: basic,
      employeePension,
      employerPension,
      totalPension: employeePension + employerPension,
      payeTax: parseFloat(item.payeTax),
    };
  });
}

export function PensionTab_NG() {
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

  const pensionMap = useMemo(() => {
    const map: Record<string, string> = {};
    (empData?.data ?? []).forEach((e) => {
      if (e.ssnit) map[e.id] = e.ssnit;
    });
    return map;
  }, [empData]);

  const rows = useMemo(
    () => (runDetail?.items ? buildRows(runDetail.items, pensionMap) : []),
    [runDetail, pensionMap],
  );

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          employeePension: acc.employeePension + r.employeePension,
          employerPension: acc.employerPension + r.employerPension,
          totalPension: acc.totalPension + r.totalPension,
          payeTax: acc.payeTax + r.payeTax,
        }),
        { employeePension: 0, employerPension: 0, totalPension: 0, payeTax: 0 },
      ),
    [rows],
  );

  const handleExport = () => {
    const run = availableRuns.find((r) => r.id === runId);
    const headers = [
      'Employee',
      'Employee Number',
      'Pension Account Number',
      'Basic Salary',
      `Employee Pension (${EMPLOYEE_RATE * 100}%)`,
      `Employer Pension (${EMPLOYER_RATE * 100}%)`,
      'Total Pension Remittable (18%)',
      'PAYE Tax',
    ];
    const csvRows = rows.map((r) => [
      r.name,
      r.employeeNumber,
      r.pensionNumber ?? '',
      r.basicSalary.toFixed(2),
      r.employeePension.toFixed(2),
      r.employerPension.toFixed(2),
      r.totalPension.toFixed(2),
      r.payeTax.toFixed(2),
    ]);
    const csv = [headers, ...csvRows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pension-${run ? payrollMonthLabel(run.month, run.year).replace(' ', '-') : 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns: Column<PensionRow>[] = [
    {
      key: 'employee',
      label: 'Employee',
      width: '2fr',
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900">{row.name}</p>
          <p className="text-xs text-gray-400">{row.employeeNumber}</p>
        </div>
      ),
    },
    {
      key: 'pensionNumber',
      label: 'Pension Account No.',
      render: (row) =>
        row.pensionNumber ? (
          <span className="font-mono text-sm text-gray-700">{row.pensionNumber}</span>
        ) : (
          <span className="text-xs text-gray-400 italic">Not set</span>
        ),
    },
    {
      key: 'basicSalary',
      label: 'Basic Salary',
      render: (row) => fmt(row.basicSalary),
    },
    {
      key: 'employeePension',
      label: `Employee (${EMPLOYEE_RATE * 100}%)`,
      render: (row) => fmt(row.employeePension),
    },
    {
      key: 'employerPension',
      label: `Employer (${EMPLOYER_RATE * 100}%)`,
      render: (row) => fmt(row.employerPension),
    },
    {
      key: 'totalPension',
      label: 'Total Remittable (18%)',
      render: (row) => <span className="font-semibold text-gray-900">{fmt(row.totalPension)}</span>,
    },
    {
      key: 'payeTax',
      label: 'PAYE Tax',
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
          label={`Employee Pension (${EMPLOYEE_RATE * 100}%)`}
          value={fmt(totals.employeePension)}
          icon={User}
          iconColor="#6b7280"
        />
        <KpiCard
          label={`Employer Pension (${EMPLOYER_RATE * 100}%)`}
          value={fmt(totals.employerPension)}
          icon={Building2}
          iconColor="#2a78d6"
        />
        <KpiCard
          label="Total Remittable (18%)"
          value={fmt(totals.totalPension)}
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
