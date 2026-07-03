/*
  Warnings:

  - You are about to drop the column `variantId` on the `BasketItem` table. All the data in the column will be lost.
  - You are about to drop the column `variantId` on the `Inventory` table. All the data in the column will be lost.
  - You are about to drop the column `variantId` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `variantId` on the `ProductImage` table. All the data in the column will be lost.
  - You are about to drop the column `variantId` on the `WishlistItem` table. All the data in the column will be lost.
  - You are about to drop the `ProductVariant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VariantAttributeValue` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[basketId,productId,combinationId]` on the table `BasketItem` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[productId,warehouseId,combinationId]` on the table `Inventory` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[wishlistId,productId,combinationId]` on the table `WishlistItem` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "BasketItem" DROP CONSTRAINT "BasketItem_variantId_fkey";

-- DropForeignKey
ALTER TABLE "Inventory" DROP CONSTRAINT "Inventory_variantId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_variantId_fkey";

-- DropForeignKey
ALTER TABLE "ProductImage" DROP CONSTRAINT "ProductImage_variantId_fkey";

-- DropForeignKey
ALTER TABLE "ProductVariant" DROP CONSTRAINT "ProductVariant_productId_fkey";

-- DropForeignKey
ALTER TABLE "VariantAttributeValue" DROP CONSTRAINT "VariantAttributeValue_attributeDefinitionId_fkey";

-- DropForeignKey
ALTER TABLE "VariantAttributeValue" DROP CONSTRAINT "VariantAttributeValue_variantId_fkey";

-- DropForeignKey
ALTER TABLE "WishlistItem" DROP CONSTRAINT "WishlistItem_variantId_fkey";

-- DropIndex
DROP INDEX "BasketItem_basketId_productId_variantId_key";

-- DropIndex
DROP INDEX "BasketItem_variantId_idx";

-- DropIndex
DROP INDEX "Inventory_productId_warehouseId_variantId_key";

-- DropIndex
DROP INDEX "Inventory_variantId_idx";

-- DropIndex
DROP INDEX "OrderItem_variantId_idx";

-- DropIndex
DROP INDEX "ProductImage_variantId_idx";

-- DropIndex
DROP INDEX "WishlistItem_variantId_idx";

-- DropIndex
DROP INDEX "WishlistItem_wishlistId_productId_variantId_key";

-- AlterTable
ALTER TABLE "BasketItem" DROP COLUMN "variantId",
ADD COLUMN     "combinationId" TEXT;

-- AlterTable
ALTER TABLE "Inventory" DROP COLUMN "variantId",
ADD COLUMN     "combinationId" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN "variantId",
ADD COLUMN     "combinationId" TEXT,
ADD COLUMN     "combinationSnapshot" JSONB;

-- AlterTable
ALTER TABLE "ProductImage" DROP COLUMN "variantId",
ADD COLUMN     "combinationId" TEXT;

-- AlterTable
ALTER TABLE "WishlistItem" DROP COLUMN "variantId",
ADD COLUMN     "combinationId" TEXT;

-- DropTable
DROP TABLE "ProductVariant";

-- DropTable
DROP TABLE "VariantAttributeValue";

-- CreateTable
CREATE TABLE "ProductAttributeSelection" (
    "id" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "attributeDefinitionId" TEXT NOT NULL,
    "attributeOptionId" TEXT NOT NULL,

    CONSTRAINT "ProductAttributeSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCombination" (
    "id" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "optionsKey" TEXT NOT NULL,
    "sku" TEXT,
    "price" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCombination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCombinationValue" (
    "id" TEXT NOT NULL,
    "combinationId" TEXT NOT NULL,
    "attributeDefinitionId" TEXT NOT NULL,
    "attributeOptionId" TEXT NOT NULL,

    CONSTRAINT "ProductCombinationValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemReservation" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItemReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductAttributeSelection_productId_idx" ON "ProductAttributeSelection"("productId");

-- CreateIndex
CREATE INDEX "ProductAttributeSelection_attributeDefinitionId_idx" ON "ProductAttributeSelection"("attributeDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAttributeSelection_productId_attributeOptionId_key" ON "ProductAttributeSelection"("productId", "attributeOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCombination_sku_key" ON "ProductCombination"("sku");

-- CreateIndex
CREATE INDEX "ProductCombination_productId_idx" ON "ProductCombination"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCombination_productId_optionsKey_key" ON "ProductCombination"("productId", "optionsKey");

-- CreateIndex
CREATE INDEX "ProductCombinationValue_combinationId_idx" ON "ProductCombinationValue"("combinationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCombinationValue_combinationId_attributeDefinitionId_key" ON "ProductCombinationValue"("combinationId", "attributeDefinitionId");

-- CreateIndex
CREATE INDEX "OrderItemReservation_orderItemId_idx" ON "OrderItemReservation"("orderItemId");

-- CreateIndex
CREATE INDEX "OrderItemReservation_warehouseId_idx" ON "OrderItemReservation"("warehouseId");

-- CreateIndex
CREATE INDEX "BasketItem_combinationId_idx" ON "BasketItem"("combinationId");

-- CreateIndex
CREATE UNIQUE INDEX "BasketItem_basketId_productId_combinationId_key" ON "BasketItem"("basketId", "productId", "combinationId");

-- CreateIndex
CREATE INDEX "Inventory_combinationId_idx" ON "Inventory"("combinationId");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_productId_warehouseId_combinationId_key" ON "Inventory"("productId", "warehouseId", "combinationId");

-- CreateIndex
CREATE INDEX "OrderItem_combinationId_idx" ON "OrderItem"("combinationId");

-- CreateIndex
CREATE INDEX "ProductImage_combinationId_idx" ON "ProductImage"("combinationId");

-- CreateIndex
CREATE INDEX "WishlistItem_combinationId_idx" ON "WishlistItem"("combinationId");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_wishlistId_productId_combinationId_key" ON "WishlistItem"("wishlistId", "productId", "combinationId");

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_combinationId_fkey" FOREIGN KEY ("combinationId") REFERENCES "ProductCombination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeSelection" ADD CONSTRAINT "ProductAttributeSelection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeSelection" ADD CONSTRAINT "ProductAttributeSelection_attributeDefinitionId_fkey" FOREIGN KEY ("attributeDefinitionId") REFERENCES "AttributeDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeSelection" ADD CONSTRAINT "ProductAttributeSelection_attributeOptionId_fkey" FOREIGN KEY ("attributeOptionId") REFERENCES "AttributeOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCombination" ADD CONSTRAINT "ProductCombination_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCombinationValue" ADD CONSTRAINT "ProductCombinationValue_combinationId_fkey" FOREIGN KEY ("combinationId") REFERENCES "ProductCombination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCombinationValue" ADD CONSTRAINT "ProductCombinationValue_attributeDefinitionId_fkey" FOREIGN KEY ("attributeDefinitionId") REFERENCES "AttributeDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCombinationValue" ADD CONSTRAINT "ProductCombinationValue_attributeOptionId_fkey" FOREIGN KEY ("attributeOptionId") REFERENCES "AttributeOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BasketItem" ADD CONSTRAINT "BasketItem_combinationId_fkey" FOREIGN KEY ("combinationId") REFERENCES "ProductCombination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_combinationId_fkey" FOREIGN KEY ("combinationId") REFERENCES "ProductCombination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemReservation" ADD CONSTRAINT "OrderItemReservation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemReservation" ADD CONSTRAINT "OrderItemReservation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_combinationId_fkey" FOREIGN KEY ("combinationId") REFERENCES "ProductCombination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_combinationId_fkey" FOREIGN KEY ("combinationId") REFERENCES "ProductCombination"("id") ON DELETE SET NULL ON UPDATE CASCADE;
