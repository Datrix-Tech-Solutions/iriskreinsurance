import {
  EmployeeCompensationType,
  PayrollCountry,
  PayrollTaxPolicy,
} from '../../prisma/generated/client';
import { calculatePayrollForCountry } from './payroll-calculator.helper';

const ghSettings = {
  payrollCountry: PayrollCountry.GH,
  tier3Enabled: false,
  tier3Rate: null,
};

const baseValues = {
  basicSalary: '0',
  commissionAmount: '0',
  totalAllowances: '0',
  transportAmount: '0',
  otherDeductions: '0',
};

describe('calculatePayrollForCountry commission payroll MVP', () => {
  it('keeps existing salary payroll calculation unchanged', () => {
    const result = calculatePayrollForCountry(
      { ...baseValues, basicSalary: '5000' },
      ghSettings,
    );

    expect(result).toMatchObject({
      basicSalary: '5000',
      commissionAmount: '0',
      grossSalary: '5000',
      employeeSSNIT: '275',
      taxableIncome: '4725',
      payeTax: '779.75',
      netSalary: '3945.25',
    });
  });

  it('calculates standard PAYE for commission-only employees', () => {
    const result = calculatePayrollForCountry(
      { ...baseValues, commissionAmount: '2000' },
      {
        ...ghSettings,
        compensationType: EmployeeCompensationType.COMMISSION,
        taxPolicy: PayrollTaxPolicy.STANDARD_PAYE,
        commissionTaxable: true,
      },
    );

    expect(result).toMatchObject({
      basicSalary: '0',
      commissionAmount: '2000',
      grossSalary: '2000',
      employeeSSNIT: '0',
      taxableIncome: '2000',
      payeTax: '240.75',
      netSalary: '1759.25',
    });
  });

  it('uses fixed tax for commission-only employees when configured', () => {
    const result = calculatePayrollForCountry(
      { ...baseValues, commissionAmount: '2000' },
      {
        ...ghSettings,
        compensationType: EmployeeCompensationType.COMMISSION,
        taxPolicy: PayrollTaxPolicy.FIXED_AMOUNT,
        fixedTaxAmount: '150',
      },
    );

    expect(result).toMatchObject({
      grossSalary: '2000',
      taxableIncome: '2000',
      payeTax: '150',
      netSalary: '1850',
    });
  });

  it('excludes non-taxable commission from standard PAYE while keeping it in gross and net', () => {
    const result = calculatePayrollForCountry(
      { ...baseValues, commissionAmount: '2000' },
      {
        ...ghSettings,
        compensationType: EmployeeCompensationType.COMMISSION,
        taxPolicy: PayrollTaxPolicy.STANDARD_PAYE,
        commissionTaxable: false,
      },
    );

    expect(result).toMatchObject({
      grossSalary: '2000',
      taxableIncome: '0',
      payeTax: '0',
      netSalary: '2000',
    });
  });

  it('calculates salary-plus-commission employees with separate commission tax', () => {
    const result = calculatePayrollForCountry(
      { ...baseValues, basicSalary: '1000', commissionAmount: '500' },
      {
        ...ghSettings,
        compensationType: EmployeeCompensationType.SALARY_PLUS_COMMISSION,
        taxPolicy: PayrollTaxPolicy.STANDARD_PAYE,
        commissionTaxable: true,
      },
    );

    expect(result).toMatchObject({
      basicSalary: '1000',
      commissionAmount: '500',
      grossSalary: '1500',
      employeeSSNIT: '55',
      taxableIncome: '945',
      payeTax: '106.13',
      netSalary: '1338.88',
    });
  });

  it('supports exempt commission payroll items', () => {
    const result = calculatePayrollForCountry(
      { ...baseValues, commissionAmount: '2000' },
      {
        ...ghSettings,
        compensationType: EmployeeCompensationType.COMMISSION,
        taxPolicy: PayrollTaxPolicy.EXEMPT,
        commissionTaxable: false,
      },
    );

    expect(result).toMatchObject({
      grossSalary: '2000',
      taxableIncome: '0',
      payeTax: '0',
      netSalary: '2000',
    });
  });
});
