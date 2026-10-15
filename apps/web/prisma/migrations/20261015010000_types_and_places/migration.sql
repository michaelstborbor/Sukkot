-- AlterEnum
ALTER TYPE "PropertyCategory" ADD VALUE 'OTHER';

-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "isCity" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "osmId" TEXT;

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "propertyTypeOther" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "locations_osmId_key" ON "locations"("osmId");
