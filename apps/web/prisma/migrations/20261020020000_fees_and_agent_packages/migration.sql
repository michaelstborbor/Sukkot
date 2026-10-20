-- Tenant inspection booking fee, Sukkot Salone's 5% success fee, and the agent packages.
-- CreateEnum
CREATE TYPE "ServiceFeeStatus" AS ENUM ('DUE', 'PAID', 'WAIVED');

-- AlterEnum


ALTER TYPE "PaymentPurpose" ADD VALUE 'VIEWING_FEE';
ALTER TYPE "PaymentPurpose" ADD VALUE 'SUCCESS_FEE';

-- AlterTable
ALTER TABLE "inspections" ADD COLUMN     "feeCurrency" "Currency",
ADD COLUMN     "feeMinor" BIGINT,
ADD COLUMN     "feePaidAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "payment_transactions" ADD COLUMN     "inspectionId" TEXT,
ADD COLUMN     "serviceFeeId" TEXT;

-- AlterTable
ALTER TABLE "subscription_plans" ADD COLUMN     "areaSuggestions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "searchBoost" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "searchBoost" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "searchBoostUntil" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "service_fees" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "propertyId" TEXT,
    "sourcePaymentId" TEXT,
    "description" TEXT NOT NULL,
    "baseMinor" BIGINT NOT NULL,
    "basisPoints" INTEGER NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" "Currency" NOT NULL,
    "status" "ServiceFeeStatus" NOT NULL DEFAULT 'DUE',
    "paidAt" TIMESTAMPTZ(3),
    "waivedReason" TEXT,
    "raisedById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "service_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_suggestions" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "recipients" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_fees_reference_key" ON "service_fees"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "service_fees_sourcePaymentId_key" ON "service_fees"("sourcePaymentId");

-- CreateIndex
CREATE INDEX "service_fees_payerId_status_idx" ON "service_fees"("payerId", "status");

-- CreateIndex
CREATE INDEX "service_fees_status_createdAt_idx" ON "service_fees"("status", "createdAt");

-- CreateIndex
CREATE INDEX "listing_suggestions_subscriptionId_idx" ON "listing_suggestions"("subscriptionId");

-- CreateIndex
CREATE INDEX "listing_suggestions_propertyId_createdAt_idx" ON "listing_suggestions"("propertyId", "createdAt");

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "inspections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_serviceFeeId_fkey" FOREIGN KEY ("serviceFeeId") REFERENCES "service_fees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_fees" ADD CONSTRAINT "service_fees_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_fees" ADD CONSTRAINT "service_fees_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_fees" ADD CONSTRAINT "service_fees_sourcePaymentId_fkey" FOREIGN KEY ("sourcePaymentId") REFERENCES "payment_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_fees" ADD CONSTRAINT "service_fees_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_suggestions" ADD CONSTRAINT "listing_suggestions_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_suggestions" ADD CONSTRAINT "listing_suggestions_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Starting prices, which administrators change in Site settings: Le 250 to book an inspection, and
-- 5% of each rent, lease or purchase payment.
INSERT INTO "system_settings" ("key", "value", "updatedAt") VALUES
  ('fees.viewing', '{"priceMinor": "25000", "currency": "SLE"}', CURRENT_TIMESTAMP),
  ('fees.success', '{"basisPoints": 500}', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- Agent packages: two listings free, then Basic, Premium or Premium Pro every 30 days. They replace
-- Agent Pro, which stays on record (and in force for anyone who already paid) but is no longer sold.
INSERT INTO "subscription_plans" ("id", "code", "name", "audience", "description", "priceMinor", "currency", "periodDays", "maxListings", "featuredSlots", "searchBoost", "areaSuggestions", "features", "isActive", "sortOrder", "updatedAt") VALUES
  ('plan_agent_free', 'agent-free', 'Agent Starter', 'AGENT', 'Try Sukkot Salone with two free listings.', 0, 'SLE', 30, 2, 0, 0, 0,
    ARRAY['Up to 2 active listings', 'Enquiries, messaging and inspection booking', 'Order professional photos and video for any listing'], true, 10, CURRENT_TIMESTAMP),
  ('plan_agent_basic', 'agent-basic', 'Agent Basic', 'AGENT', 'For agents starting out.', 50000, 'SLE', 30, 10, 1, 1, 2,
    ARRAY['Up to 10 active listings', 'Your listings appear above free listings in search', '1 featured listing (7 days) every 30 days', 'Suggest 2 listings every 30 days to people searching in that area'], true, 11, CURRENT_TIMESTAMP),
  ('plan_agent_premium', 'agent-premium', 'Agent Premium', 'AGENT', 'For busy agents who want more reach.', 100000, 'SLE', 30, 30, 3, 2, 6,
    ARRAY['Up to 30 active listings', 'Your listings appear above Basic and free listings in search', '3 featured listings (7 days each) every 30 days', 'Suggest 6 listings every 30 days to people searching in that area'], true, 12, CURRENT_TIMESTAMP),
  ('plan_agent_premium_pro', 'agent-premium-pro', 'Agent Premium Pro', 'AGENT', 'For agencies and top agents.', 200000, 'SLE', 30, NULL, 6, 3, 15,
    ARRAY['Unlimited active listings', 'Your listings appear first in search, after featured listings', '6 featured listings (7 days each) every 30 days', 'Suggest 15 listings every 30 days to people searching in that area'], true, 13, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

UPDATE "subscription_plans" SET "isActive" = false WHERE "code" = 'agent-pro';
