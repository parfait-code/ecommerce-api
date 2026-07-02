/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `Basket` will be added. If there are existing duplicate values, this will fail.
  - Made the column `weight` on table `Product` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "PickupRequest" ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "shipmentId" TEXT;

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "weight" SET NOT NULL,
ALTER COLUMN "weight" SET DEFAULT 0.5;

-- CreateIndex
CREATE UNIQUE INDEX "Basket_userId_key" ON "Basket"("userId");

-- CreateIndex
CREATE INDEX "PickupRequest_orderId_idx" ON "PickupRequest"("orderId");

-- CreateIndex
CREATE INDEX "PickupRequest_shipmentId_idx" ON "PickupRequest"("shipmentId");

-- AddForeignKey
ALTER TABLE "PickupRequest" ADD CONSTRAINT "PickupRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupRequest" ADD CONSTRAINT "PickupRequest_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
