-- Add channel-aware announcement delivery while preserving sendEmail compatibility.
CREATE TYPE "hr"."AnnouncementDeliveryChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS');

ALTER TABLE "hr"."Announcement"
ADD COLUMN "deliveryChannels" "hr"."AnnouncementDeliveryChannel"[] NOT NULL
DEFAULT ARRAY['IN_APP']::"hr"."AnnouncementDeliveryChannel"[];

UPDATE "hr"."Announcement"
SET "deliveryChannels" = CASE
  WHEN "sendEmail" = TRUE THEN ARRAY['IN_APP', 'EMAIL']::"hr"."AnnouncementDeliveryChannel"[]
  ELSE ARRAY['IN_APP']::"hr"."AnnouncementDeliveryChannel"[]
END;
