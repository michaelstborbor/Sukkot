-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "reminderSentAt" TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "subscriptions_status_endsAt_idx" ON "subscriptions"("status", "endsAt");
