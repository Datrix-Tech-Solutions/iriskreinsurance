-- AlterTable
ALTER TABLE "hr"."LeaveType" ADD COLUMN     "applicableTo" "hr"."EmploymentType"[] DEFAULT ARRAY[]::"hr"."EmploymentType"[];
