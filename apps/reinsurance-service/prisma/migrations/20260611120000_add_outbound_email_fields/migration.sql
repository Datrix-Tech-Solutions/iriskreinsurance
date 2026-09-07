CREATE TYPE "reinsurance"."EmailMessageStatus" AS ENUM ('DRAFT', 'SENDING', 'SENT', 'FAILED');

ALTER TABLE "reinsurance"."EmailMessage"
ADD COLUMN "status" "reinsurance"."EmailMessageStatus" NOT NULL DEFAULT 'SENT',
ADD COLUMN "bccRecipients" JSONB,
ADD COLUMN "replyToRecipients" JSONB,
ADD COLUMN "bodyText" TEXT,
ADD COLUMN "bodyHtml" TEXT,
ADD COLUMN "errorMessage" TEXT,
ADD COLUMN "inReplyToMessageId" TEXT,
ADD COLUMN "parentMessageId" TEXT;
