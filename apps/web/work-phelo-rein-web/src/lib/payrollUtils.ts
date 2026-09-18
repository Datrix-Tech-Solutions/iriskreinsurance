import type { PayrollRunDetail, PayrollItem, AllowanceType } from '@/types/hr';
import type { PayslipCompanyInfo, PayslipEmployeeInfo, PayslipYTD } from '@/types/payroll';
export type { PayslipCompanyInfo, PayslipEmployeeInfo, PayslipYTD };
import {
  formatPayrollMoney,
  getPayrollLabels,
  resolvePayrollCurrency,
  normalizePayrollCountry,
} from '@/lib/payrollDisplay';
import type { SearchSelectOption } from '@/components/atoms/SearchSelect';

export const MONTH_NAMES = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function payrollMonthLabel(month: number, year: number): string {
  return `${MONTH_NAMES[month]} ${year}`;
}

/** Shared month options for SearchSelect / select fields across payroll UI. */
export const MONTH_OPTIONS = MONTH_NAMES.slice(1).map((label, i) => ({
  value: String(i + 1),
  label,
}));

// ── Allowance type lists ───────────────────────────────────────────────────────

/** Options for allowance-type SearchSelects (payroll items & company policy forms). */
export const ALLOWANCE_TYPE_OPTIONS: { value: AllowanceType; label: string }[] = [
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'HOUSING', label: 'Housing' },
  { value: 'MEDICAL', label: 'Medical' },
  { value: 'CLOTHING', label: 'Clothing' },
  { value: 'OTHER', label: 'Other' },
];

/** Human-readable label for each allowance type. */
export const ALLOWANCE_TYPE_LABEL: Record<AllowanceType, string> = {
  TRANSPORT: 'Transport',
  HOUSING: 'Housing',
  MEDICAL: 'Medical',
  CLOTHING: 'Clothing',
  OTHER: 'Other',
};

/** Tailwind badge classes for each allowance type. */
export const ALLOWANCE_TYPE_COLOR: Record<AllowanceType, string> = {
  TRANSPORT: 'bg-orange-50 text-orange-600',
  HOUSING: 'bg-blue-50 text-blue-600',
  MEDICAL: 'bg-emerald-50 text-emerald-600',
  CLOTHING: 'bg-purple-50 text-purple-600',
  OTHER: 'bg-gray-100 text-gray-500',
};

/** Preset allowance name suggestions used in the payroll items panel. */
export const COMMON_ALLOWANCE_NAMES: SearchSelectOption[] = [
  { value: 'Transport Allowance', label: 'Transport Allowance' },
  { value: 'Housing Allowance', label: 'Housing Allowance' },
  { value: 'Medical Allowance', label: 'Medical Allowance' },
  { value: 'Lunch Allowance', label: 'Lunch Allowance' },
  { value: 'Fuel Allowance', label: 'Fuel Allowance' },
  { value: 'Entertainment Allowance', label: 'Entertainment Allowance' },
  { value: 'Communication Allowance', label: 'Communication Allowance' },
  { value: '__other__', label: 'Other' },
];

function fmtNum(value: string | number | null | undefined): string {
  if (value == null) return '—';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n)) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function payrollCurrencyForItem(item: PayrollItem): string {
  return resolvePayrollCurrency(item.payrollRun?.payrollCurrency, item.payrollRun?.payrollCountry);
}

function payrollCurrencyForRun(detail: PayrollRunDetail): string {
  return resolvePayrollCurrency(detail.payrollCurrency, detail.payrollCountry);
}

function payrollAllowanceRows(item: PayrollItem): Array<[string, number]> {
  if (item.allowanceItems?.length) {
    return item.allowanceItems
      .map((allowance) => [allowance.name, parseFloat(allowance.amount)] as [string, number])
      .filter(([, amount]) => amount > 0);
  }

  const rows: Array<[string, number]> = [];
  const transportAmount = parseFloat(item.transportAmount);
  const nonTransportAllowances = parseFloat(item.totalAllowances);
  if (transportAmount > 0) rows.push(['Transport Allowance', transportAmount]);
  if (nonTransportAllowances > 0) rows.push(['Allowances', nonTransportAllowances]);
  return rows;
}

function payrollDeductionRows(item: PayrollItem): Array<[string, number]> {
  if (item.deductionItems?.length) {
    return item.deductionItems
      .map((deduction) => [deduction.name, parseFloat(deduction.amount)] as [string, number])
      .filter(([, amount]) => amount > 0);
  }

  const otherDeductions = parseFloat(item.otherDeductions);
  return otherDeductions > 0 ? [['Deductions', otherDeductions]] : [];
}

function lineItemsSummary(rows: Array<[string, number]>, fallback: string | number): string {
  if (rows.length === 0) return fmtNum(fallback);
  return rows.map(([name, amount]) => `${name}: ${fmtNum(amount)}`).join('; ');
}

function sumLineItems(rows: Array<[string, number]>, fallback: string | number): number {
  if (rows.length > 0) return rows.reduce((sum, [, amount]) => sum + amount, 0);
  const value = typeof fallback === 'string' ? parseFloat(fallback) : fallback;
  return Number.isFinite(value) ? value : 0;
}

// Round to 2dp — matches backend Decimal.js precision
function r2(n: number) {
  return Math.round(n * 100) / 100;
}

function triggerCSV(filename: string, rows: string[][]): void {
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadPayrollPDFFormat(
  detail: PayrollRunDetail,
  label: string,
  format: 'bank' | 'full' = 'full',
  companyName = '',
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  let headerY = 16;
  if (companyName) {
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, 14, headerY);
    headerY += 7;
  }

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Payroll Report', 14, headerY);
  headerY += 7;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(label, 14, headerY);
  doc.setTextColor(0, 0, 0);

  const payrollLabels = getPayrollLabels(detail.payrollCountry);
  const isGhana = normalizePayrollCountry(detail.payrollCountry) === 'GH';
  const startY = companyName ? 37 : 30;

  // r2 is module-scoped below — no need to redefine here

  // Derive salary-only figures for SALARY_PLUS_COMMISSION items
  function salarySectionFigs(item: PayrollItem) {
    if (item.compensationTypeSnapshot !== 'SALARY_PLUS_COMMISSION') return null;
    const commission = parseFloat(item.commissionAmount);
    const commissionTax = r2(commission * 0.1);
    return {
      gross: parseFloat(item.grossSalary) - commission,
      paye: r2(parseFloat(item.payeTax) - commissionTax),
      net: r2(parseFloat(item.netSalary) - (commission - commissionTax)),
    };
  }

  // Derive commission-only figures for commission section
  function commissionSectionFigs(item: PayrollItem) {
    const commission = parseFloat(item.commissionAmount);
    if (item.compensationTypeSnapshot === 'SALARY_PLUS_COMMISSION') {
      const tax = r2(commission * 0.1);
      return {
        commission,
        allowances: 0,
        deductions: 0,
        gross: commission,
        tax,
        net: r2(commission - tax),
      };
    }
    return {
      commission,
      allowances: sumLineItems(payrollAllowanceRows(item), parseFloat(item.totalAllowances)),
      deductions: sumLineItems(payrollDeductionRows(item), parseFloat(item.otherDeductions)),
      gross: parseFloat(item.grossSalary),
      tax: parseFloat(item.payeTax),
      net: parseFloat(item.netSalary),
    };
  }

  const sharedTableStyles = {
    headStyles: {
      fillColor: [13, 31, 68] as [number, number, number],
      textColor: 255 as unknown as [number, number, number],
      fontStyle: 'bold' as const,
      fontSize: 8,
    },
    bodyStyles: { fontSize: 8 },
    footStyles: {
      fillColor: [240, 242, 247] as [number, number, number],
      textColor: [13, 31, 68] as [number, number, number],
      fontStyle: 'bold' as const,
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [248, 249, 250] as [number, number, number] },
    showFoot: 'lastPage' as const,
  };

  function sectionLabel(text: string, y: number) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text(text, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
  }

  function lastTableY(): number {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (doc as any).lastAutoTable?.finalY ?? startY + 20;
  }

  if (format === 'bank') {
    const head = [
      ['Employee', 'Employee Number', 'Bank Name', 'Bank Branch', 'Account Number', 'Net Salary'],
    ];
    const body = detail.items.map((item) => [
      item.employee ? `${item.employee.firstName} ${item.employee.lastName}` : '',
      item.employee?.employeeNumber ?? '',
      item.employee?.bankName ?? '',
      item.employee?.bankBranch ?? '',
      item.employee?.bankAccountNumber ?? '',
      fmtNum(item.netSalary),
    ]);
    const foot = [
      [
        'TOTAL',
        '',
        '',
        '',
        '',
        fmtNum(detail.items.reduce((s, i) => s + parseFloat(i.netSalary || '0'), 0)),
      ],
    ];

    autoTable(doc, {
      startY,
      head,
      body,
      foot,
      ...sharedTableStyles,
      columnStyles: { 5: { halign: 'right' as const, fontStyle: 'bold' as const } },
      didParseCell: (data) => {
        if (data.section === 'foot' && data.column.index === 5) data.cell.styles.halign = 'right';
      },
    });
  } else {
    const salaryItems = detail.items.filter((i) => i.compensationTypeSnapshot !== 'COMMISSION');
    const commissionItems = detail.items.filter((i) => i.compensationTypeSnapshot !== 'SALARY');
    const hasBoth = salaryItems.length > 0 && commissionItems.length > 0;
    let currentY = startY;

    // ── Salary section ─────────────────────────────────────────────────────────
    if (salaryItems.length > 0) {
      if (hasBoth) {
        sectionLabel('SALARY', currentY);
        currentY += 5;
      }

      const ssnitHeaders = isGhana
        ? ['Tier 1 (0.5%)', 'Tier 2 (5%)']
        : [payrollLabels.employeeLabel];
      const salaryHead = [
        [
          'Employee',
          'Employee Number',
          'Basic Salary',
          'Allowances',
          'Gross',
          ...ssnitHeaders,
          'PAYE',
          'Deductions',
          'Net Salary',
        ],
      ];

      const salaryBody = salaryItems.map((item) => {
        const s = salarySectionFigs(item);
        const allowances = sumLineItems(
          payrollAllowanceRows(item),
          parseFloat(item.totalAllowances),
        );
        const deductions = sumLineItems(
          payrollDeductionRows(item),
          parseFloat(item.otherDeductions),
        );
        const ssnitVals = isGhana
          ? [fmtNum(item.tier1Contribution), fmtNum(item.tier2Contribution)]
          : [fmtNum(item.employeeSSNIT)];
        return [
          item.employee ? `${item.employee.firstName} ${item.employee.lastName}` : '',
          item.employee?.employeeNumber ?? '',
          fmtNum(item.basicSalary),
          fmtNum(allowances),
          fmtNum(s ? s.gross : parseFloat(item.grossSalary)),
          ...ssnitVals,
          fmtNum(s ? s.paye : parseFloat(item.payeTax)),
          fmtNum(deductions),
          fmtNum(s ? s.net : parseFloat(item.netSalary)),
        ];
      });

      const st = {
        basicSalary: salaryItems.reduce((a, i) => a + parseFloat(i.basicSalary || '0'), 0),
        allowances: salaryItems.reduce(
          (a, i) => a + sumLineItems(payrollAllowanceRows(i), parseFloat(i.totalAllowances)),
          0,
        ),
        gross: salaryItems.reduce((a, i) => {
          const s = salarySectionFigs(i);
          return a + (s ? s.gross : parseFloat(i.grossSalary));
        }, 0),
        tier1: isGhana
          ? salaryItems.reduce((a, i) => a + parseFloat(i.tier1Contribution || '0'), 0)
          : 0,
        tier2: isGhana
          ? salaryItems.reduce((a, i) => a + parseFloat(i.tier2Contribution || '0'), 0)
          : 0,
        ssnit: !isGhana
          ? salaryItems.reduce((a, i) => a + parseFloat(i.employeeSSNIT || '0'), 0)
          : 0,
        paye: salaryItems.reduce((a, i) => {
          const s = salarySectionFigs(i);
          return a + (s ? s.paye : parseFloat(i.payeTax || '0'));
        }, 0),
        deductions: salaryItems.reduce(
          (a, i) => a + sumLineItems(payrollDeductionRows(i), parseFloat(i.otherDeductions)),
          0,
        ),
        net: salaryItems.reduce((a, i) => {
          const s = salarySectionFigs(i);
          return a + (s ? s.net : parseFloat(i.netSalary || '0'));
        }, 0),
      };
      const ssnitTotals = isGhana ? [fmtNum(st.tier1), fmtNum(st.tier2)] : [fmtNum(st.ssnit)];
      const salaryFoot = [
        [
          'TOTAL',
          '',
          fmtNum(st.basicSalary),
          fmtNum(st.allowances),
          fmtNum(st.gross),
          ...ssnitTotals,
          fmtNum(st.paye),
          fmtNum(st.deductions),
          fmtNum(st.net),
        ],
      ];

      const totalCols = salaryHead[0].length;
      const salaryNumericCols = Array.from({ length: totalCols - 2 }, (_, i) => i + 2);
      const salaryLastCol = totalCols - 1;

      autoTable(doc, {
        startY: currentY,
        head: salaryHead,
        body: salaryBody,
        foot: salaryFoot,
        ...sharedTableStyles,
        columnStyles: Object.fromEntries(
          salaryNumericCols.map((i) => [
            i,
            {
              halign: 'right' as const,
              fontStyle: i === salaryLastCol ? ('bold' as const) : ('normal' as const),
            },
          ]),
        ),
        didParseCell: (data) => {
          if (data.section === 'foot' && salaryNumericCols.includes(data.column.index)) {
            data.cell.styles.halign = 'right';
          }
        },
      });

      currentY = lastTableY() + (hasBoth ? 10 : 0);
    }

    // ── Commission section ──────────────────────────────────────────────────────
    if (commissionItems.length > 0) {
      if (hasBoth) {
        sectionLabel('COMMISSION', currentY);
        currentY += 5;
      }

      const commHead = [
        [
          'Employee',
          'Employee Number',
          'Commission',
          'Allowances',
          'Deductions',
          'Gross',
          'Tax (10%)',
          'Net Pay',
        ],
      ];

      const commBody = commissionItems.map((item) => {
        const c = commissionSectionFigs(item);
        return [
          item.employee ? `${item.employee.firstName} ${item.employee.lastName}` : '',
          item.employee?.employeeNumber ?? '',
          fmtNum(c.commission),
          fmtNum(c.allowances),
          fmtNum(c.deductions),
          fmtNum(c.gross),
          fmtNum(c.tax),
          fmtNum(c.net),
        ];
      });

      const ct = commissionItems.reduce(
        (acc, item) => {
          const c = commissionSectionFigs(item);
          return {
            commission: acc.commission + c.commission,
            allowances: acc.allowances + c.allowances,
            deductions: acc.deductions + c.deductions,
            gross: acc.gross + c.gross,
            tax: acc.tax + c.tax,
            net: acc.net + c.net,
          };
        },
        { commission: 0, allowances: 0, deductions: 0, gross: 0, tax: 0, net: 0 },
      );
      const commFoot = [
        [
          'TOTAL',
          '',
          fmtNum(ct.commission),
          fmtNum(ct.allowances),
          fmtNum(ct.deductions),
          fmtNum(ct.gross),
          fmtNum(ct.tax),
          fmtNum(ct.net),
        ],
      ];

      autoTable(doc, {
        startY: currentY,
        head: commHead,
        body: commBody,
        foot: commFoot,
        ...sharedTableStyles,
        columnStyles: {
          2: { halign: 'right' as const },
          3: { halign: 'right' as const },
          4: { halign: 'right' as const },
          5: { halign: 'right' as const },
          6: { halign: 'right' as const },
          7: { halign: 'right' as const, fontStyle: 'bold' as const },
        },
        didParseCell: (data) => {
          if (data.section === 'foot' && [2, 3, 4, 5, 6, 7].includes(data.column.index)) {
            data.cell.styles.halign = 'right';
          }
        },
      });
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.width - 14,
      doc.internal.pageSize.height - 8,
      { align: 'right' },
    );
  }

  doc.save(`payroll-${format}-${label}.pdf`);
}

function numberToWords(n: number): string {
  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];

  if (n === 0) return 'Zero';

  function below1000(num: number): string {
    if (num === 0) return '';
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + ones[num % 10] : '');
    return (
      ones[Math.floor(num / 100)] +
      ' Hundred' +
      (num % 100 !== 0 ? ' and ' + below1000(num % 100) : '')
    );
  }

  let rem = Math.floor(n);
  let result = '';
  if (rem >= 1000000) {
    result += below1000(Math.floor(rem / 1000000)) + ' Million ';
    rem %= 1000000;
  }
  if (rem >= 1000) {
    result += below1000(Math.floor(rem / 1000)) + ' Thousand ';
    rem %= 1000;
  }
  if (rem > 0) {
    if (result) result += 'and ';
    result += below1000(rem);
  }
  return result.trim();
}

function amountInWords(value: string | number, currency: string): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n) || n < 0) return '';
  const whole = Math.floor(n);
  const fractional = Math.round((n - whole) * 100);
  let words = `${numberToWords(whole)} ${currency}`;
  if (fractional > 0) words += ` ${numberToWords(fractional)}/100`;
  return words + ' Only';
}

function companyInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 5);
}

function payslipNumber(companyName: string, itemId: string): string {
  const initials = companyInitials(companyName) || 'PS';
  const suffix = itemId.replace(/-/g, '').slice(-6).toUpperCase();
  return `${initials}-${suffix}`;
}

export async function downloadPayslipPDF(
  item: PayrollItem,
  label: string,
  company: PayslipCompanyInfo | string = '',
  employeeProfile?: PayslipEmployeeInfo,
  ytd?: PayslipYTD,
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');

  const companyInfo: PayslipCompanyInfo = typeof company === 'string' ? { name: company } : company;
  const payrollCountry = item.payrollRun?.payrollCountry;
  const payrollCurrency = payrollCurrencyForItem(item);
  const payrollLabels = getPayrollLabels(payrollCountry);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.width;
  const M = 14; // margin
  const mid = pageW / 2;
  const lastAutoTable = () =>
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // ── Header ────────────────────────────────────────────────────────────────
  // Left: company name then branch location then contact
  let hy = 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(13, 31, 68);
  doc.text(companyInfo.name || 'Company', M, hy);
  hy += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);

  // Branch address line: "123 High St, Accra, Greater Accra, Ghana"
  if (employeeProfile) {
    const { branchAddress, branchCity, branchRegion, branchCountry } = employeeProfile;
    const cityRegion = [branchCity, branchRegion].filter(Boolean).join(', ');
    const addressLine = [branchAddress, cityRegion, branchCountry].filter(Boolean).join(', ');
    if (addressLine) {
      doc.text(addressLine, M, hy);
      hy += 4;
    }
  }

  const contactLine = [companyInfo.phone, companyInfo.email].filter(Boolean).join('  |  ');
  if (contactLine) {
    doc.text(contactLine, M, hy);
    hy += 4;
  }

  // Right: PAYSLIP title + meta
  const payPeriod = label;
  const payDate = item.payrollRun?.paidAt
    ? new Date(item.payrollRun.paidAt).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : item.payrollRun
      ? new Date(item.payrollRun.year, item.payrollRun.month, 0).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : '—';
  const psNo = payslipNumber(companyInfo.name, item.id);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(13, 31, 68);
  doc.text('PAYSLIP', pageW - M, 16, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(`Pay Period: ${payPeriod}`, pageW - M, 23, { align: 'right' });
  doc.text(`Pay Date: ${payDate}`, pageW - M, 27, { align: 'right' });
  doc.text(`Payslip No: ${psNo}`, pageW - M, 31, { align: 'right' });

  // Divider
  const divY = Math.max(hy, 34) + 2;
  doc.setDrawColor(13, 31, 68);
  doc.setLineWidth(0.5);
  doc.line(M, divY, pageW - M, divY);
  doc.setLineWidth(0.2);

  // ── Employee info grid ────────────────────────────────────────────────────
  let y = divY + 6;
  // prefer the full profile passed in; fall back to the summary embedded in the item
  const emp: PayslipEmployeeInfo | undefined =
    employeeProfile ??
    (item.employee
      ? {
          firstName: item.employee.firstName,
          lastName: item.employee.lastName,
          employeeNumber: item.employee.employeeNumber,
          jobTitle: item.employee.jobTitle,
          department: item.employee.department ?? undefined,
          tinNumber: item.employee.tinNumber ?? undefined,
          ssnit: item.employee.ssnit ?? undefined,
          branchName: item.employee.branchName ?? undefined,
          bankName: item.employee.bankName ?? undefined,
          bankBranch: item.employee.bankBranch ?? undefined,
          bankAccountNumber: item.employee.bankAccountNumber ?? undefined,
        }
      : undefined);

  const labelStyle = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(40, 40, 40);
  };
  const valueStyle = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
  };

  const infoRows: [string, string, string, string][] = [
    [
      'Employee Name:',
      emp ? `${emp.firstName} ${emp.lastName}` : '—',
      'Employee ID:',
      emp?.employeeNumber ?? '—',
    ],
    ['Role:', emp?.jobTitle ?? '—', 'Department:', emp?.department ?? '—'],
    ['TIN:', emp?.tinNumber ?? '—', `${payrollLabels.idLabel}:`, emp?.ssnit ?? '—'],
    ['Bank:', emp?.bankName ?? '—', 'Account No:', emp?.bankAccountNumber ?? '—'],
  ];
  if (emp?.bankBranch) {
    infoRows.push(['Bank Branch:', emp.bankBranch, 'Location:', emp?.branchName ?? '—']);
  } else if (emp?.branchName) {
    infoRows.push(['Location:', emp.branchName, '', '']);
  }

  const colW = (pageW - M * 2) / 2;
  const labelW = 28;

  for (const [l1, v1, l2, v2] of infoRows) {
    labelStyle();
    doc.text(l1, M, y);
    valueStyle();
    doc.text(v1, M + labelW, y);
    if (l2) {
      labelStyle();
      doc.text(l2, mid, y);
      valueStyle();
      doc.text(v2, mid + labelW, y);
    }
    y += 5.5;
  }

  y += 3;
  doc.setDrawColor(220, 220, 220);
  doc.line(M, y, pageW - M, y);
  y += 5;

  // ── Side-by-side earnings / deductions ───────────────────────────────────
  const tableW = colW - 2;
  const earningsStartY = y;

  const earningsRows: string[][] = [];
  if (parseFloat(item.basicSalary) > 0)
    earningsRows.push(['Basic Salary', fmtNum(item.basicSalary)]);
  if (parseFloat(item.commissionAmount ?? '0') > 0)
    earningsRows.push(['Commission', fmtNum(item.commissionAmount)]);
  payrollAllowanceRows(item).forEach(([name, amount]) => {
    earningsRows.push([name, fmtNum(amount)]);
  });
  if (parseFloat(item.overtimePay) > 0)
    earningsRows.push(['Overtime Pay', fmtNum(item.overtimePay)]);
  if (parseFloat(item.bonus) > 0) earningsRows.push(['Bonus / Incentive', fmtNum(item.bonus)]);
  if (parseFloat(item.thirteenthMonth) > 0)
    earningsRows.push(['13th Month', fmtNum(item.thirteenthMonth)]);

  const isBothPDF = item.compensationTypeSnapshot === 'SALARY_PLUS_COMMISSION';
  const isCommissionOnly = item.compensationTypeSnapshot === 'COMMISSION';
  const commissionTaxPDF = isBothPDF ? r2(parseFloat(item.commissionAmount) * 0.1) : 0;
  const salaryPayePDF = isBothPDF ? r2(parseFloat(item.payeTax) - commissionTaxPDF) : 0;

  const deductionRows: string[][] = [];
  if (parseFloat(item.employeeSSNIT) > 0)
    deductionRows.push([payrollLabels.employeeLabel, fmtNum(item.employeeSSNIT)]);
  if (isBothPDF) {
    deductionRows.push(['Income Tax (PAYE)', fmtNum(salaryPayePDF)]);
    deductionRows.push(['Commission Tax (10%)', fmtNum(commissionTaxPDF)]);
  } else {
    deductionRows.push([
      isCommissionOnly
        ? 'Commission Tax (10%)'
        : item.taxPolicySnapshot === 'FIXED_AMOUNT'
          ? 'Income Tax (PAYE - Fixed)'
          : 'Income Tax (PAYE)',
      fmtNum(item.payeTax),
    ]);
  }
  if (parseFloat(item.tier3Employee) > 0)
    deductionRows.push(['Tier 3', fmtNum(item.tier3Employee)]);
  payrollDeductionRows(item).forEach(([name, amount]) => {
    deductionRows.push([name, fmtNum(amount)]);
  });

  const tableHeadStyles = {
    fillColor: [13, 31, 68] as [number, number, number],
    textColor: 255 as number,
    fontSize: 8,
    fontStyle: 'bold' as const,
  };
  const tableBodyStyles = { fontSize: 8 };
  const tableFootStyles = {
    fillColor: [235, 238, 245] as [number, number, number],
    textColor: [13, 31, 68] as [number, number, number],
    fontStyle: 'bold' as const,
    fontSize: 8,
  };

  // Earnings (left)
  autoTable(doc, {
    startY: earningsStartY,
    head: [['EARNINGS', `Amount (${payrollCurrency})`]],
    body: earningsRows,
    foot: [['GROSS EARNINGS', fmtNum(item.grossSalary)]],
    showFoot: 'lastPage',
    headStyles: tableHeadStyles,
    bodyStyles: tableBodyStyles,
    footStyles: tableFootStyles,
    columnStyles: { 1: { halign: 'right' } },
    didParseCell: (data) => {
      if (data.section === 'foot' && data.column.index === 1) data.cell.styles.halign = 'right';
    },
    margin: { left: M, right: M + tableW + 4 },
    tableWidth: tableW,
  });
  const earningsFinalY = lastAutoTable();

  // Deductions (right)
  autoTable(doc, {
    startY: earningsStartY,
    head: [['DEDUCTIONS', `Amount (${payrollCurrency})`]],
    body: deductionRows,
    foot: [['TOTAL DEDUCTIONS', fmtNum(item.totalDeductions)]],
    showFoot: 'lastPage',
    headStyles: { ...tableHeadStyles, fillColor: [150, 40, 40] },
    bodyStyles: tableBodyStyles,
    footStyles: tableFootStyles,
    columnStyles: { 1: { halign: 'right' } },
    didParseCell: (data) => {
      if (data.section === 'foot' && data.column.index === 1) data.cell.styles.halign = 'right';
    },
    margin: { left: M + tableW + 4, right: M },
    tableWidth: tableW,
  });
  const deductionsFinalY = lastAutoTable();

  y = Math.max(earningsFinalY, deductionsFinalY) + 6;

  // ── Net Pay in Words + Net Pay (one unified bar) ─────────────────────────
  const totalW = pageW - M * 2;
  const wordsW = totalW * 0.58;
  const netW = totalW - wordsW;
  const netBarH = 22;
  const splitX = M + wordsW;
  const overlap = 3; // hides inner rounded corners so the two halves look like one shape

  // Left half: light fill extended slightly past split to cover its right rounded corners
  doc.setFillColor(232, 237, 248);
  doc.roundedRect(M, y, wordsW + overlap, netBarH, 2, 2, 'F');

  // Right half: dark navy fill overlapping the right edge of the left half
  doc.setFillColor(13, 31, 68);
  doc.roundedRect(splitX - overlap, y, netW + overlap, netBarH, 2, 2, 'F');

  // Outer border over the whole bar
  doc.setDrawColor(190, 205, 230);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, totalW, netBarH, 2, 2, 'S');
  doc.setLineWidth(0.2);

  // Left text: "Net Pay in Words:" + words
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text('Net Pay in Words:', M + 5, y + 7);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  const words = amountInWords(item.netSalary, payrollCurrency);
  const lines = doc.splitTextToSize(words, wordsW - 10) as string[];
  doc.text(lines.slice(0, 2), M + 5, y + 14);

  // Right text: NET PAY label + amount — right-aligned within the right box
  const rightEdge = M + totalW - 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(180, 200, 240);
  doc.text('NET PAY', rightEdge, y + 7, { align: 'right' });
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(formatPayrollMoney(item.netSalary, payrollCurrency, payrollCountry), rightEdge, y + 15, {
    align: 'right',
  });

  y += netBarH + 6;

  // ── Year-to-Date Summary ───────────────────────────────────────────────────
  if (ytd) {
    doc.setFillColor(13, 31, 68);
    doc.roundedRect(M, y, totalW, 7, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('YEAR-TO-DATE (YTD) SUMMARY', M + 4, y + 5);
    y += 10;

    const ytdCellW = totalW / 2;
    const ytdRows: [string, string, string, string][] = [
      [
        'YTD Gross Earnings',
        formatPayrollMoney(ytd.grossEarnings, payrollCurrency, payrollCountry),
        'YTD PAYE Tax',
        formatPayrollMoney(ytd.payeTax, payrollCurrency, payrollCountry),
      ],
      [
        `YTD ${payrollLabels.tabLabel} Contribution`,
        formatPayrollMoney(ytd.ssnitContribution, payrollCurrency, payrollCountry),
        'YTD Net Pay',
        formatPayrollMoney(ytd.netPay, payrollCurrency, payrollCountry),
      ],
    ];

    for (const [l1, v1, l2, v2] of ytdRows) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(40, 40, 40);
      doc.text(l1, M + 4, y + 4);
      doc.setFont('helvetica', 'normal');
      doc.text(v1, M + ytdCellW - 4, y + 4, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.text(l2, M + ytdCellW + 4, y + 4);
      doc.setFont('helvetica', 'normal');
      doc.text(v2, M + totalW - 4, y + 4, { align: 'right' });

      doc.setDrawColor(220, 220, 220);
      doc.line(M, y + 7, M + totalW, y + 7);
      y += 9;
    }
    y += 2;
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const footerY = doc.internal.pageSize.height - 10;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  const footerContact = companyInfo.email
    ? `  |  For queries contact HR: ${companyInfo.email}`
    : '';
  doc.text(
    `This is a computer-generated payslip and does not require a signature.${footerContact}`,
    pageW / 2,
    footerY,
    { align: 'center' },
  );

  const empName = emp ? `${emp.firstName}-${emp.lastName}` : 'payslip';
  doc.save(`payslip-${empName}-${label}.pdf`);
}

export function downloadPayrollBankFormat(
  detail: PayrollRunDetail,
  label: string,
  companyName = '',
): void {
  const currency = payrollCurrencyForRun(detail);
  const headers = [
    'Employee',
    'Employee Number',
    'Bank Name',
    'Bank Branch',
    'Account Number',
    `Net Salary (${currency})`,
  ];
  const rows = detail.items.map((item) => [
    item.employee ? `${item.employee.firstName} ${item.employee.lastName}` : '',
    item.employee?.employeeNumber ?? '',
    item.employee?.bankName ?? '',
    item.employee?.bankBranch ?? '',
    item.employee?.bankAccountNumber ?? '',
    fmtNum(item.netSalary),
  ]);
  const meta = companyName ? [[companyName], [`Payroll Report — ${label}`], []] : [];
  triggerCSV(`payroll-bank-${label}.csv`, [...meta, headers, ...rows]);
}

export function downloadPayrollFullFormat(
  detail: PayrollRunDetail,
  label: string,
  companyName = '',
): void {
  const payrollLabels = getPayrollLabels(detail.payrollCountry);
  const currency = payrollCurrencyForRun(detail);
  const headers = [
    'Employee',
    'Employee Number',
    'Job Title',
    `Basic Salary (${currency})`,
    `Commission (${currency})`,
    `Allowances (${currency})`,
    `Gross Salary (${currency})`,
    `${payrollLabels.employeeLabel} (${currency})`,
    `${payrollLabels.employerLabel} (${currency})`,
    'PAYE',
    `Deductions (${currency})`,
    `Net Salary (${currency})`,
  ];
  const rows = detail.items.map((item) => [
    item.employee ? `${item.employee.firstName} ${item.employee.lastName}` : '',
    item.employee?.employeeNumber ?? '',
    item.employee?.jobTitle ?? '',
    fmtNum(item.basicSalary),
    fmtNum(item.commissionAmount ?? 0),
    lineItemsSummary(payrollAllowanceRows(item), item.totalAllowances),
    fmtNum(item.grossSalary),
    fmtNum(item.employeeSSNIT),
    fmtNum(item.employerSSNIT),
    fmtNum(item.payeTax),
    lineItemsSummary(payrollDeductionRows(item), item.otherDeductions),
    fmtNum(item.netSalary),
  ]);
  const meta = companyName ? [[companyName], [`Payroll Report — ${label}`], []] : [];
  triggerCSV(`payroll-full-${label}.csv`, [...meta, headers, ...rows]);
}

export async function downloadTAXFormPDF(
  payslips: PayrollItem[],
  year: number,
  company: PayslipCompanyInfo,
  employee?: PayslipEmployeeInfo,
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.width;
  const pageH = doc.internal.pageSize.height;
  const M = 10;
  const cW = pageW - M * 2;
  let y = M;

  const navy: [number, number, number] = [13, 31, 68];
  const lastY = () =>
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  const byMonth: Record<number, PayrollItem> = {};
  payslips
    .filter((p) => p.payrollRun?.year === year)
    .forEach((p) => {
      if (p.payrollRun) byMonth[p.payrollRun.month] = p;
    });
  const primaryPayslip = Object.values(byMonth)[0] ?? payslips[0];
  const payrollCountry = primaryPayslip?.payrollRun?.payrollCountry;
  const payrollCurrency = primaryPayslip ? payrollCurrencyForItem(primaryPayslip) : 'GHS';
  const payrollLabels = getPayrollLabels(payrollCountry);

  const getField = (item: PayrollItem, key: string): string => {
    return (item as unknown as Record<string, string>)[key] ?? '0';
  };

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...navy);
  doc.text(company.name || 'EMPLOYER', M, y + 7);

  const contactParts: string[] = [];
  if (company.phone) contactParts.push(company.phone);
  if (company.email) contactParts.push(company.email);
  const contactLine = contactParts.join('  |  ');
  if (contactLine) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    doc.text(contactLine, M, y + 13);
  }

  const rightEdgeX = M + cW;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...navy);
  doc.text('TAX FORM', rightEdgeX, y + 7, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  doc.text('EMPLOYEE TAX DEDUCTION CARD', rightEdgeX, y + 13, { align: 'right' });
  doc.text('Employee tax deduction summary', rightEdgeX, y + 18, {
    align: 'right',
  });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...navy);
  doc.text(`Year of Assessment: ${year}`, rightEdgeX, y + 24, { align: 'right' });

  y += 28;
  doc.setDrawColor(200, 200, 210);
  doc.setLineWidth(0.3);
  doc.line(M, y, M + cW, y);
  y += 4;

  // ── Section header helper ─────────────────────────────────────────────────
  const sectionHeader = (letter: string, title: string) => {
    doc.setFillColor(...navy);
    doc.rect(M, y, cW, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`${letter}   ${title}`, M + 3, y + 4.5);
    y += 8;
  };

  // ── Field drawing helpers ─────────────────────────────────────────────────
  const drawLabelValue = (
    label: string,
    value: string | undefined | null,
    x: number,
    fy: number,
    totalW: number,
    labelW: number,
  ) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(label, x, fy + 4.5);
    const valX = x + labelW;
    const valW = totalW - labelW;
    const val = value ?? '';
    if (val) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(20, 20, 20);
      const truncated = (doc.splitTextToSize(val, valW) as string[])[0];
      doc.text(truncated, valX, fy + 4.5);
    } else {
      doc.setDrawColor(140, 140, 140);
      doc.setLineWidth(0.2);
      doc.line(valX, fy + 5.5, x + totalW, fy + 5.5);
    }
  };

  const fieldH = 7;
  const halfW = cW / 2 - 2;

  // ── Section A: Employer Details ───────────────────────────────────────────
  sectionHeader('A', 'EMPLOYER DETAILS');
  drawLabelValue('Employer Name:', company.name, M, y, halfW, 30);
  drawLabelValue('Contact:', contactLine || undefined, M + halfW + 4, y, halfW, 22);
  y += fieldH;
  drawLabelValue('Employer TIN:', undefined, M, y, halfW, 30);
  drawLabelValue('GRA District Office:', undefined, M + halfW + 4, y, halfW, 38);
  y += fieldH + 3;

  // ── Section B: Employee Details ───────────────────────────────────────────
  sectionHeader('B', 'EMPLOYEE DETAILS');
  const qW = cW / 4 - 1;
  const empFullName = employee ? `${employee.firstName} ${employee.lastName}` : undefined;
  const bankText =
    employee?.bankName && employee.bankBranch
      ? `${employee.bankName} (${employee.bankBranch})`
      : (employee?.bankName ?? undefined);

  drawLabelValue('Name:', empFullName, M, y, qW, 14);
  drawLabelValue('Employee ID:', employee?.employeeNumber, M + qW + 1, y, qW, 22);
  drawLabelValue('Job Title:', employee?.jobTitle, M + (qW + 1) * 2, y, qW, 18);
  drawLabelValue('TIN:', employee?.tinNumber, M + (qW + 1) * 3, y, qW, 10);
  y += fieldH;
  drawLabelValue(`${payrollLabels.idLabel}:`, employee?.ssnit, M, y, qW, 18);
  drawLabelValue('Department:', employee?.department, M + qW + 1, y, qW, 22);
  drawLabelValue('Bank:', bankText, M + (qW + 1) * 2, y, qW, 14);
  drawLabelValue('Account No:', employee?.bankAccountNumber, M + (qW + 1) * 3, y, qW, 22);
  y += fieldH + 3;

  // ── Section C: Monthly Earnings and Deductions ────────────────────────────
  sectionHeader('C', `MONTHLY EARNINGS AND DEDUCTIONS (Amount in ${payrollCurrency})`);

  const shortMonths = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const descColW = 38;
  const remW = cW - descColW;
  const mColW = parseFloat((remW / 13).toFixed(2));

  const cellRowDefs = [
    { key: 'basicSalary', label: 'Basic Salary' },
    { key: 'commissionAmount', label: 'Commission' },
    { key: 'grossSalary', label: 'Gross Earnings' },
    { key: 'employeeSSNIT', label: payrollLabels.employeeLabel },
    { key: 'taxableIncome', label: 'Taxable Income' },
    { key: 'payeTax', label: 'Income Tax (PAYE)' },
    { key: 'totalDeductions', label: 'Total Deductions' },
    { key: 'netSalary', label: 'Net Pay' },
  ];

  const tableBody = cellRowDefs.map(({ key, label }) => {
    const monthVals = shortMonths.map((_, i) => {
      const p = byMonth[i + 1];
      return p ? fmtNum(getField(p, key)) : '';
    });
    const rowTotal = shortMonths.reduce((sum, _, i) => {
      const p = byMonth[i + 1];
      return sum + (p ? parseFloat(getField(p, key)) || 0 : 0);
    }, 0);
    const hasAny = monthVals.some((v) => v !== '');
    return [label, ...monthVals, hasAny ? fmtNum(rowTotal) : ''];
  });

  autoTable(doc, {
    startY: y,
    head: [['', ...shortMonths, 'Total']],
    body: tableBody,
    headStyles: {
      fillColor: [230, 235, 245] as [number, number, number],
      textColor: navy,
      fontSize: 6,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 1.5,
    },
    bodyStyles: { fontSize: 6, halign: 'right', cellPadding: 1.5 },
    columnStyles: {
      0: { halign: 'left', cellWidth: descColW },
      ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, { cellWidth: mColW }])),
      13: {
        cellWidth: mColW,
        fontStyle: 'bold',
        fillColor: [230, 235, 245] as [number, number, number],
        textColor: navy,
      },
    },
    alternateRowStyles: { fillColor: [248, 249, 252] as [number, number, number] },
    willDrawCell: (data) => {
      if (data.section === 'body' && data.column.index > 0 && data.cell.raw === '') {
        const { x, y: cy, height: ch, width: cw } = data.cell;
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.15);
        doc.line(x + 1, cy + ch - 1.5, x + cw - 1, cy + ch - 1.5);
      }
    },
    margin: { left: M, right: M },
    tableWidth: cW,
  });

  y = lastY() + 4;

  if (y > pageH - 55) {
    doc.addPage();
    y = M;
  }

  // ── Section D: Annual Summary ─────────────────────────────────────────────
  sectionHeader('D', 'ANNUAL SUMMARY');

  const annualTotals = cellRowDefs.map(({ key, label }) => ({
    label,
    total: shortMonths.reduce((sum, _, i) => {
      const p = byMonth[i + 1];
      return sum + (p ? parseFloat(getField(p, key)) || 0 : 0);
    }, 0),
  }));

  const dHalfW = cW / 2 - 4;
  const dLabelW = 44;

  for (let i = 0; i < annualTotals.length; i += 2) {
    const left = annualTotals[i];
    const right = annualTotals[i + 1];

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 60);
    doc.text(`${left.label}:`, M, y + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.text(
      left.total > 0 ? formatPayrollMoney(left.total, payrollCurrency, payrollCountry) : '—',
      M + dLabelW + dHalfW - dLabelW,
      y + 4.5,
      { align: 'right' },
    );

    if (right) {
      const rx = M + dHalfW + 6;
      doc.setFont('helvetica', 'bold');
      doc.text(`${right.label}:`, rx, y + 4.5);
      doc.setFont('helvetica', 'normal');
      doc.text(
        right.total > 0 ? formatPayrollMoney(right.total, payrollCurrency, payrollCountry) : '—',
        rx + dHalfW - dLabelW + dLabelW,
        y + 4.5,
        { align: 'right' },
      );
    }

    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.15);
    doc.line(M, y + 6.5, M + cW, y + 6.5);
    y += 8;
  }

  y += 3;

  if (y > pageH - 45) {
    doc.addPage();
    y = M;
  }

  // ── Section E: Reliefs and Allowances (omitted — not tracked by system) ──

  sectionHeader('E', 'RELIEFS AND ALLOWANCES (For Reference Only)');
  const reliefs = [
    `Personal Relief (${payrollCurrency})`,
    'Marriage/Responsibility Relief',
    'Child Education Relief',
    'Old Age / Disability Relief',
    'Aged Dependent Relative Relief',
    'Self-Education Relief',
  ];
  const relColW = cW / 3 - 2;
  for (let i = 0; i < reliefs.length; i += 3) {
    const row = reliefs.slice(i, i + 3);
    for (let j = 0; j < row.length; j++) {
      const rx = M + j * (relColW + 3);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(60, 60, 60);
      doc.text(`${row[j]}:`, rx, y + 4.5);
      doc.setDrawColor(140, 140, 140);
      doc.setLineWidth(0.2);
      doc.line(rx + relColW - 28, y + 5.5, rx + relColW, y + 5.5);
    }
    y += 8;
  }
  y += 3;

  if (y > pageH - 35) {
    doc.addPage();
    y = M;
  }

  // ── Section F: Certification and Declaration ──────────────────────────────
  sectionHeader('F', 'CERTIFICATION AND DECLARATION');

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  const declaration =
    'I hereby certify that the information given in this form is correct and complete to the best of my knowledge and belief.';
  const declLines = doc.splitTextToSize(declaration, cW) as string[];
  doc.text(declLines, M, y + 4);
  y += declLines.length * 4 + 8;

  const sigW = cW / 3 - 4;
  const sigs = [
    { label: "Employer's Signature", sub: 'Name & Designation' },
    { label: 'Date', sub: '' },
    { label: 'Official Stamp / Seal', sub: '' },
  ];

  for (let i = 0; i < sigs.length; i++) {
    const sx = M + i * (sigW + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    doc.text(`${sigs[i].label}:`, sx, y + 4);
    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.25);
    doc.line(sx, y + 10, sx + sigW, y + 10);
    if (sigs[i].sub) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(140, 140, 140);
      doc.text(sigs[i].sub, sx, y + 14);
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const footY = pageH - 6;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(140, 140, 140);
  doc.text(
    'GRA Helpline: 0800-900-110 (Toll Free)  |  www.gra.gov.gh  |  This form is for official tax reporting purposes only.',
    pageW / 2,
    footY,
    { align: 'center' },
  );

  const empSuffix = employee ? `${employee.lastName}-${employee.firstName}` : 'employee';
  doc.save(`TAX-Form-${empSuffix}-${year}.pdf`);
}
