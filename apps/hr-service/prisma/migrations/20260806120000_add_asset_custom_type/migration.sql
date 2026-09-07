-- Store the free-text label a user enters when Asset.type is 'OTHER',
-- instead of overloading the type enum column with arbitrary text.

ALTER TABLE "hr"."Asset" ADD COLUMN "customType" TEXT;
