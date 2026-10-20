-- Bookings of hotels, guest houses, motels and short-stay homes through Sukkot Salone: room types,
-- bookings, and the payment purposes for a booking and for the listing fee.
-- CreateEnum
CREATE TYPE "StayKind" AS ENUM ('HOTEL', 'GUEST_HOUSE', 'MOTEL', 'SHORT_STAY_HOME');

-- CreateEnum
CREATE TYPE "CancellationPolicy" AS ENUM ('FLEXIBLE', 'MODERATE', 'STRICT', 'NON_REFUNDABLE');

-- CreateEnum
CREATE TYPE "StayBookingStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'PAID', 'COMPLETED', 'NO_SHOW', 'UNAVAILABLE', 'CANCELLED', 'EXPIRED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentPurpose" ADD VALUE 'STAY_BOOKING';
ALTER TYPE "PaymentPurpose" ADD VALUE 'STAY_LISTING';

-- AlterTable
ALTER TABLE "payment_transactions" ADD COLUMN     "stayBookingId" TEXT;

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "stayArrangedAt" TIMESTAMPTZ(3),
ADD COLUMN     "stayCommissionBps" INTEGER,
ADD COLUMN     "stayDetails" JSONB,
ADD COLUMN     "stayKind" "StayKind",
ADD COLUMN     "stayListingPaidAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "stay_room_types" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "bedType" TEXT,
    "roomsCount" INTEGER NOT NULL DEFAULT 1,
    "maxAdults" INTEGER NOT NULL DEFAULT 2,
    "maxChildren" INTEGER NOT NULL DEFAULT 0,
    "nightlyPriceMinor" BIGINT NOT NULL,
    "monthlyPriceMinor" BIGINT,
    "currency" "Currency" NOT NULL DEFAULT 'SLE',
    "breakfastIncluded" BOOLEAN NOT NULL DEFAULT false,
    "features" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stay_room_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stay_bookings" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "status" "StayBookingStatus" NOT NULL DEFAULT 'REQUESTED',
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "nights" INTEGER NOT NULL,
    "rooms" INTEGER NOT NULL DEFAULT 1,
    "adults" INTEGER NOT NULL,
    "children" INTEGER NOT NULL DEFAULT 0,
    "guestName" TEXT NOT NULL,
    "guestPhone" TEXT NOT NULL,
    "guestEmail" TEXT NOT NULL,
    "guestCountry" TEXT,
    "arrivalTime" TEXT,
    "extras" JSONB NOT NULL DEFAULT '{}',
    "specialRequests" TEXT,
    "leadDays" INTEGER NOT NULL,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "priceBreakdown" JSONB NOT NULL,
    "stayAmountMinor" BIGINT NOT NULL,
    "lateFeeMinor" BIGINT NOT NULL DEFAULT 0,
    "cleaningFeeMinor" BIGINT NOT NULL DEFAULT 0,
    "totalMinor" BIGINT NOT NULL,
    "currency" "Currency" NOT NULL,
    "cancellationPolicy" "CancellationPolicy" NOT NULL,
    "confirmedAt" TIMESTAMPTZ(3),
    "confirmedById" TEXT,
    "propertyConfirmation" TEXT,
    "paymentDueAt" TIMESTAMPTZ(3),
    "roomNumber" TEXT,
    "staffNote" TEXT,
    "internalNote" TEXT,
    "paidAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "cancelledBy" TEXT,
    "cancelReason" TEXT,
    "refundDueMinor" BIGINT,
    "refundedMinor" BIGINT NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMPTZ(3),
    "payoutMinor" BIGINT,
    "payoutReference" TEXT,
    "payoutAt" TIMESTAMPTZ(3),
    "payoutById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stay_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stay_room_types_propertyId_isActive_idx" ON "stay_room_types"("propertyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "stay_bookings_reference_key" ON "stay_bookings"("reference");

-- CreateIndex
CREATE INDEX "stay_bookings_status_createdAt_idx" ON "stay_bookings"("status", "createdAt");

-- CreateIndex
CREATE INDEX "stay_bookings_guestId_createdAt_idx" ON "stay_bookings"("guestId", "createdAt");

-- CreateIndex
CREATE INDEX "stay_bookings_propertyId_checkIn_idx" ON "stay_bookings"("propertyId", "checkIn");

-- CreateIndex
CREATE INDEX "payment_transactions_stayBookingId_idx" ON "payment_transactions"("stayBookingId");

-- AddForeignKey
ALTER TABLE "stay_room_types" ADD CONSTRAINT "stay_room_types_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stay_bookings" ADD CONSTRAINT "stay_bookings_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stay_bookings" ADD CONSTRAINT "stay_bookings_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "stay_room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stay_bookings" ADD CONSTRAINT "stay_bookings_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_stayBookingId_fkey" FOREIGN KEY ("stayBookingId") REFERENCES "stay_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Starting prices, which administrators change in Site settings: Le 1,000 for a property to be listed
-- for bookings (listing, photos and video), and bookings made less than 7 days before check-in cost
-- 10% more.
INSERT INTO "system_settings" ("key", "value", "updatedAt") VALUES
  ('stay.listingFee', '{"priceMinor": "100000", "currency": "SLE"}', CURRENT_TIMESTAMP),
  ('stay.lateBooking', '{"noticeDays": 7, "surchargePercent": 10}', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
