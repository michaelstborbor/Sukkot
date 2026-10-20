-- Professional photo shoots booked from the listing form, and listers' private contact details.
ALTER TYPE "PaymentPurpose" ADD VALUE 'PHOTO_SHOOT';

CREATE TYPE "SiteVisitKind" AS ENUM ('INSPECTION', 'PHOTO_SHOOT');
ALTER TABLE "site_visits" ADD COLUMN "kind" "SiteVisitKind" NOT NULL DEFAULT 'INSPECTION';
ALTER TABLE "site_visits" ADD COLUMN "requestNote" TEXT;

ALTER TABLE "properties" ADD COLUMN "privateContactPhone" TEXT;
ALTER TABLE "properties" ADD COLUMN "privateContactEmail" TEXT;

-- The photo shoot fee: Le 300 per property, non-refundable. Administrators change it in Site settings.
INSERT INTO "system_settings" ("key", "value", "updatedAt") VALUES
  ('visit.photoShoot', '{"priceMinor": "30000", "currency": "SLE"}', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
