CREATE TABLE "hr"."PayrollItemAllowance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "payrollItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollItemAllowance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hr"."PayrollItemDeduction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "payrollItemId" TEXT NOT NULL,
    "employeeDeductionId" TEXT,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollItemDeduction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PayrollItemAllowance_tenantId_payrollItemId_idx" ON "hr"."PayrollItemAllowance"("tenantId", "payrollItemId");

CREATE INDEX "PayrollItemDeduction_tenantId_payrollItemId_idx" ON "hr"."PayrollItemDeduction"("tenantId", "payrollItemId");

ALTER TABLE "hr"."PayrollItemAllowance"
ADD CONSTRAINT "PayrollItemAllowance_payrollItemId_fkey"
FOREIGN KEY ("payrollItemId") REFERENCES "hr"."PayrollItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hr"."PayrollItemDeduction"
ADD CONSTRAINT "PayrollItemDeduction_payrollItemId_fkey"
FOREIGN KEY ("payrollItemId") REFERENCES "hr"."PayrollItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
