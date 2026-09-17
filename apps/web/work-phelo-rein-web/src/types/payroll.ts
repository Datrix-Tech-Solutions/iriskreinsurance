/**
 * Central payroll domain types.
 *
 * All payroll-related TypeScript types live here.
 * `src/types/hr.ts` re-exports everything for backward compatibility.
 */

import type { AllowanceItem } from '@/lib/payrollCalculations';

// ── Core status / country enums ────────────────────────────────────────────────

export type PayrollRunStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PAID';
export type PayrollCountry = 'GH' | 'NG' | 'KE';
export type EmployeeCompensationType = 'SALARY' | 'COMMISSION' | 'SALARY_PLUS_COMMISSION';
export type PayrollTaxPolicy = 'STANDARD_PAYE' | 'FIXED_AMOUNT' | 'EXEMPT';

// ── Payroll run ────────────────────────────────────────────────────────────────

export interface PayrollRun {
  id: string;
  month: number;
  year: number;
  status: PayrollRunStatus;
  notes?: string;
  totalGross: string;
  totalNet: string;
  totalSSNIT: string;
  totalTier1: string;
  totalTier2: string;
  totalTier3: string;
  totalPAYE: string;
  totalEmployerCost: string;
  runBy: string;
  submittedBy?: string | null;
  submittedAt?: string | null;
  approvedBy?: string;
  approvedAt?: string;
  approvalNote?: string | null;
  returnToDraftNote?: string | null;
  paidAt?: string;
  payrollCountry: PayrollCountry;
  payrollCurrency: string;
  tier3Enabled: boolean;
  tier3Rate?: string | null;
  tier3SchemeName?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface PayrollRunEmployeeSummary {
  firstName: string;
  lastName: string;
  employeeNumber: string;
  jobTitle: string;
  department?: string | null;
  tinNumber?: string | null;
  ssnit?: string | null;
  branchName?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  bankAccountNumber?: string | null;
}

// ── Payroll item ───────────────────────────────────────────────────────────────

export interface PayrollItemAllowance {
  id: string;
  payrollItemId: string;
  name: string;
  type?: string | null;
  amount: string;
}

export interface PayrollItemDeduction {
  id: string;
  payrollItemId: string;
  employeeDeductionId?: string | null;
  name: string;
  amount: string;
}

export interface PayrollItem {
  id: string;
  tenantId: string;
  payrollRunId: string;
  employeeId: string;
  basicSalary: string;
  commissionAmount: string;
  totalAllowances: string;
  allowanceItems?: PayrollItemAllowance[];
  transportAmount: string;
  otherDeductions: string;
  deductionItems?: PayrollItemDeduction[];
  overtimePay: string;
  bonus: string;
  thirteenthMonth: string;
  grossSalary: string;
  employeeSSNIT: string;
  employerSSNIT: string;
  tier1Contribution: string;
  tier2Contribution: string;
  tier3Employee: string;
  taxableIncome: string;
  payeTax: string;
  totalDeductions: string;
  netSalary: string;
  fixedTaxAmount?: string | null;
  taxPolicySnapshot?: PayrollTaxPolicy;
  compensationTypeSnapshot?: EmployeeCompensationType;
  commissionTaxableSnapshot?: boolean;
  createdAt: string;
  updatedAt?: string;
  employee?: PayrollRunEmployeeSummary;
  payrollRun?: {
    month: number;
    year: number;
    status: PayrollRunStatus;
    paidAt?: string | null;
    payrollCountry?: PayrollCountry;
    payrollCurrency?: string;
    tier3Enabled: boolean;
    tier3Rate?: string | null;
    tier3SchemeName?: string | null;
  };
}

export interface PayrollRunDetail extends PayrollRun {
  items: PayrollItem[];
}

// ── DTOs ───────────────────────────────────────────────────────────────────────

export interface PayrollDecisionDto {
  note: string;
}

export interface RunPayrollDto {
  month: number;
  year: number;
  notes?: string;
}

export interface UpdatePayrollItemDto {
  basicSalary?: number;
  commissionAmount?: number;
  totalAllowances?: number;
  transportAmount?: number;
  otherDeductions?: number;
  taxPolicy?: PayrollTaxPolicy;
  fixedTaxAmount?: number | null;
  commissionTaxable?: boolean;
  allowanceItems?: Array<{
    name: string;
    type?: string | null;
    amount: number;
  }>;
  deductionItems?: Array<{
    employeeDeductionId?: string | null;
    name: string;
    amount: number;
  }>;
}

// ── Settings ───────────────────────────────────────────────────────────────────

export interface PayrollSettings {
  payrollCountry: PayrollCountry;
  payrollCurrency: string;
  payrollTier2FundName: string | null;
  payrollTier3Enabled: boolean;
  payrollTier3Rate: number | null;
  payrollTier3SchemeName: string | null;
}

export interface UpdatePayrollSettingsDto {
  payrollCountry?: PayrollCountry;
  payrollCurrency?: string;
  payrollTier2FundName?: string;
  payrollTier3Enabled?: boolean;
  payrollTier3Rate?: number;
  payrollTier3SchemeName?: string;
}

// ── Payslip display ────────────────────────────────────────────────────────────

export interface PayslipCompanyInfo {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface PayslipEmployeeInfo {
  firstName: string;
  lastName: string;
  employeeNumber?: string;
  jobTitle?: string;
  department?: string;
  tinNumber?: string;
  ssnit?: string;
  branchName?: string;
  branchAddress?: string;
  branchCity?: string;
  branchRegion?: string;
  branchCountry?: string;
  bankName?: string;
  bankBranch?: string;
  bankAccountNumber?: string;
}

export interface PayslipYTD {
  grossEarnings: number;
  ssnitContribution: number;
  payeTax: number;
  netPay: number;
}

// ── Shared panel types ─────────────────────────────────────────────────────────

/** Per-employee overrides passed into a payroll run. */
export interface EmployeeOverride {
  basicSalary?: number;
  commissionAmount?: number;
  totalAllowances?: number;
  transportAmount?: number;
  otherDeductions?: number;
  taxPolicy?: PayrollTaxPolicy;
  fixedTaxAmount?: number | null;
  commissionTaxable?: boolean;
  allowanceItems?: Array<{
    name: string;
    type?: string | null;
    amount: number;
  }>;
  deductionItems?: Array<{
    employeeDeductionId?: string | null;
    name: string;
    amount: number;
  }>;
}

/** A single deduction line used when building / editing payroll items. */
export interface DeductionLineItem {
  employeeDeductionId?: string | null;
  name: string;
  amount: number;
}

/** Data loaded from a draft payroll run and passed to the run panel. */
export interface DraftLoadData {
  basicMap: Record<string, number>;
  commissionMap: Record<string, number>;
  taxPolicyMap: Record<string, PayrollTaxPolicy>;
  fixedTaxAmountMap: Record<string, number | null>;
  commissionTaxableMap: Record<string, boolean>;
  allowancesMap: Record<string, AllowanceItem[]>;
  deductionItemsMap: Record<string, DeductionLineItem[]>;
}
