-- CreateEnum
CREATE TYPE "SiteVisitStatus" AS ENUM ('REQUESTED', 'SCHEDULED', 'COMPLETED', 'CANCELLED');

-- AlterEnum


ALTER TYPE "PaymentPurpose" ADD VALUE 'INSPECTION_VISIT';
ALTER TYPE "PaymentPurpose" ADD VALUE 'LISTING_SLOT';

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "inspectedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "extraListingSlots" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "site_visits" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "status" "SiteVisitStatus" NOT NULL DEFAULT 'REQUESTED',
    "paymentId" TEXT,
    "contactPhone" TEXT,
    "scheduledAt" TIMESTAMPTZ(3),
    "staffId" TEXT,
    "staffNote" TEXT,
    "cancelReason" TEXT,
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "site_visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_visits_paymentId_key" ON "site_visits"("paymentId");

-- CreateIndex
CREATE INDEX "site_visits_status_createdAt_idx" ON "site_visits"("status", "createdAt");

-- CreateIndex
CREATE INDEX "site_visits_propertyId_idx" ON "site_visits"("propertyId");

-- AddForeignKey
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payment_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Starting prices (minor units, so 35000 is Le 350). Administrators change them in Site settings;
-- an existing value is never overwritten.
INSERT INTO "system_settings" ("key", "value", "updatedAt") VALUES
  ('visit.inspection',  '{"priceMinor": "35000", "currency": "SLE"}', CURRENT_TIMESTAMP),
  ('listing.extraSlot', '{"priceMinor": "10000", "currency": "SLE"}', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
