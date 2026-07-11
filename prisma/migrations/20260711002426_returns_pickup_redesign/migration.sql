/*
  Warnings:

  - You are about to drop the column `pickupAddress` on the `PickupRequest` table. All the data in the column will be lost.
  - You are about to drop the column `shipmentId` on the `PickupRequest` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[returnRequestId]` on the table `PickupRequest` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `deadline` to the `PickupRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `returnRequestId` to the `PickupRequest` table without a default value. This is not possible if the table is not empty.
  - Made the column `orderId` on table `PickupRequest` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "PickupCollectionMethod" AS ENUM ('ORIGINAL_ADDRESS', 'WAREHOUSE_DROPOFF', 'CUSTOM_ADDRESS');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PickupStatus" ADD VALUE 'COMPLETED';
ALTER TYPE "PickupStatus" ADD VALUE 'EXPIRED';

-- AlterEnum
ALTER TYPE "ReturnStatus" ADD VALUE 'CANCELLED';

-- DropForeignKey
ALTER TABLE "PickupRequest" DROP CONSTRAINT "PickupRequest_orderId_fkey";

-- DropForeignKey
ALTER TABLE "PickupRequest" DROP CONSTRAINT "PickupRequest_shipmentId_fkey";

-- DropIndex
DROP INDEX "PickupRequest_shipmentId_idx";

-- AlterTable
ALTER TABLE "Address" ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "recipientName" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "postalCode" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PickupRequest" DROP COLUMN "pickupAddress",
DROP COLUMN "shipmentId",
ADD COLUMN     "addressId" TEXT,
ADD COLUMN     "deadline" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "method" "PickupCollectionMethod" NOT NULL DEFAULT 'ORIGINAL_ADDRESS',
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "returnRequestId" TEXT NOT NULL,
ADD COLUMN     "warehouseId" TEXT,
ALTER COLUMN "pickupDate" DROP NOT NULL,
ALTER COLUMN "orderId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ReturnRequest" ADD COLUMN     "collectionAddressId" TEXT,
ADD COLUMN     "collectionMethod" "PickupCollectionMethod" NOT NULL DEFAULT 'ORIGINAL_ADDRESS',
ADD COLUMN     "collectionWarehouseId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PickupRequest_returnRequestId_key" ON "PickupRequest"("returnRequestId");

-- CreateIndex
CREATE INDEX "PickupRequest_status_idx" ON "PickupRequest"("status");

-- CreateIndex
CREATE INDEX "PickupRequest_deadline_idx" ON "PickupRequest"("deadline");

-- AddForeignKey
ALTER TABLE "PickupRequest" ADD CONSTRAINT "PickupRequest_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupRequest" ADD CONSTRAINT "PickupRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupRequest" ADD CONSTRAINT "PickupRequest_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupRequest" ADD CONSTRAINT "PickupRequest_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_collectionAddressId_fkey" FOREIGN KEY ("collectionAddressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_collectionWarehouseId_fkey" FOREIGN KEY ("collectionWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
