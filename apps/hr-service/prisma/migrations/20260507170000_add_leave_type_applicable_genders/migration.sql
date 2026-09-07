ALTER TABLE "hr"."LeaveType"
ADD COLUMN "applicableGenders" "hr"."Gender"[] DEFAULT ARRAY[]::"hr"."Gender"[];

UPDATE "hr"."LeaveType"
SET "applicableGenders" = ARRAY['FEMALE']::"hr"."Gender"[]
WHERE "isDefault" = true
  AND "name" = 'Maternity Leave';

UPDATE "hr"."LeaveType"
SET "applicableGenders" = ARRAY['MALE']::"hr"."Gender"[]
WHERE "isDefault" = true
  AND "name" = 'Paternity Leave';
