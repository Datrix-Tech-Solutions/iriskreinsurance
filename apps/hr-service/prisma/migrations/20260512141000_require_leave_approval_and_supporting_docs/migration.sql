ALTER TABLE "hr"."LeaveType"
ADD COLUMN "requiresSupportingDocument" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "hr"."LeaveRequest"
ADD COLUMN "supportingDocumentName" TEXT,
ADD COLUMN "supportingDocumentUrl" TEXT;

UPDATE "hr"."LeaveType"
SET "requiresApproval" = true;

UPDATE "hr"."LeaveType"
SET "requiresSupportingDocument" = true
WHERE LOWER("name") = 'sick leave';
