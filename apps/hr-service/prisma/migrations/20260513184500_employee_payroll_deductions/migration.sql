CREATE TABLE "hr"."EmployeeDeduction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "monthlyRate" DECIMAL(15,2) NOT NULL,
    "amountPaid" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeDeduction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmployeeDeduction_tenantId_employeeId_idx" ON "hr"."EmployeeDeduction"("tenantId", "employeeId");

ALTER TABLE "hr"."EmployeeDeduction"
ADD CONSTRAINT "EmployeeDeduction_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "hr"."Employee"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
