-- Commission-based payroll MVP.
CREATE TYPE hr."EmployeeCompensationType" AS ENUM (
  'SALARY',
  'COMMISSION',
  'SALARY_PLUS_COMMISSION'
);

CREATE TYPE hr."PayrollTaxPolicy" AS ENUM (
  'STANDARD_PAYE',
  'FIXED_AMOUNT',
  'EXEMPT'
);

ALTER TABLE hr."Employee"
  ADD COLUMN "compensationType" hr."EmployeeCompensationType" NOT NULL DEFAULT 'SALARY',
  ADD COLUMN "taxPolicy" hr."PayrollTaxPolicy" NOT NULL DEFAULT 'STANDARD_PAYE',
  ADD COLUMN "fixedTaxAmount" DECIMAL(15, 2),
  ADD COLUMN "commissionTaxable" BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE hr."PayrollItem"
  ADD COLUMN "commissionAmount" DECIMAL(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "fixedTaxAmount" DECIMAL(15, 2),
  ADD COLUMN "taxPolicySnapshot" hr."PayrollTaxPolicy" NOT NULL DEFAULT 'STANDARD_PAYE',
  ADD COLUMN "compensationTypeSnapshot" hr."EmployeeCompensationType" NOT NULL DEFAULT 'SALARY',
  ADD COLUMN "commissionTaxableSnapshot" BOOLEAN NOT NULL DEFAULT TRUE;
