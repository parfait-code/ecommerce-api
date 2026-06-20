/*
  Warnings:

  - A unique constraint covering the columns `[basketId,productId,variantId]` on the table `BasketItem` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[productId,warehouseId,variantId]` on the table `Inventory` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[wishlistId,productId,variantId]` on the table `WishlistItem` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AttributeType" AS ENUM ('TEXT', 'NUMBER', 'COLOR', 'BOOLEAN', 'SELECT');

-- DropIndex
DROP INDEX "BasketItem_basketId_productId_key";

-- DropIndex
DROP INDEX "Inventory_productId_warehouseId_key";

-- DropIndex
DROP INDEX "WishlistItem_wishlistId_productId_key";

-- AlterTable
ALTER TABLE "BasketItem" ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "Inventory" ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "WishlistItem" ADD COLUMN     "variantId" TEXT;

-- CreateTable
CREATE TABLE "AttributeDefinition" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "AttributeType" NOT NULL,
    "unit" TEXT,
    "isVariant" BOOLEAN NOT NULL DEFAULT false,
    "isFilterable" BOOLEAN NOT NULL DEFAULT true,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttributeDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributeOption" (
    "id" TEXT NOT NULL,
    "attributeDefinitionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "colorHex" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AttributeOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAttributeValue" (
    "id" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "attributeDefinitionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "ProductAttributeValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "sku" TEXT NOT NULL,
    "price" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariantAttributeValue" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "attributeDefinitionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "VariantAttributeValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttributeDefinition_categoryId_idx" ON "AttributeDefinition"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "AttributeDefinition_categoryId_slug_key" ON "AttributeDefinition"("categoryId", "slug");

-- CreateIndex
CREATE INDEX "AttributeOption_attributeDefinitionId_idx" ON "AttributeOption"("attributeDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "AttributeOption_attributeDefinitionId_value_key" ON "AttributeOption"("attributeDefinitionId", "value");

-- CreateIndex
CREATE INDEX "ProductAttributeValue_productId_idx" ON "ProductAttributeValue"("productId");

-- CreateIndex
CREATE INDEX "ProductAttributeValue_attributeDefinitionId_value_idx" ON "ProductAttributeValue"("attributeDefinitionId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAttributeValue_productId_attributeDefinitionId_key" ON "ProductAttributeValue"("productId", "attributeDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");

-- CreateIndex
CREATE INDEX "VariantAttributeValue_variantId_idx" ON "VariantAttributeValue"("variantId");

-- CreateIndex
CREATE INDEX "VariantAttributeValue_attributeDefinitionId_value_idx" ON "VariantAttributeValue"("attributeDefinitionId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "VariantAttributeValue_variantId_attributeDefinitionId_key" ON "VariantAttributeValue"("variantId", "attributeDefinitionId");

-- CreateIndex
CREATE INDEX "BasketItem_variantId_idx" ON "BasketItem"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "BasketItem_basketId_productId_variantId_key" ON "BasketItem"("basketId", "productId", "variantId");

-- CreateIndex
CREATE INDEX "Inventory_variantId_idx" ON "Inventory"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_productId_warehouseId_variantId_key" ON "Inventory"("productId", "warehouseId", "variantId");

-- CreateIndex
CREATE INDEX "OrderItem_variantId_idx" ON "OrderItem"("variantId");

-- CreateIndex
CREATE INDEX "ProductImage_variantId_idx" ON "ProductImage"("variantId");

-- CreateIndex
CREATE INDEX "WishlistItem_variantId_idx" ON "WishlistItem"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_wishlistId_productId_variantId_key" ON "WishlistItem"("wishlistId", "productId", "variantId");

-- AddForeignKey
ALTER TABLE "AttributeDefinition" ADD CONSTRAINT "AttributeDefinition_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributeOption" ADD CONSTRAINT "AttributeOption_attributeDefinitionId_fkey" FOREIGN KEY ("attributeDefinitionId") REFERENCES "AttributeDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeValue" ADD CONSTRAINT "ProductAttributeValue_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeValue" ADD CONSTRAINT "ProductAttributeValue_attributeDefinitionId_fkey" FOREIGN KEY ("attributeDefinitionId") REFERENCES "AttributeDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantAttributeValue" ADD CONSTRAINT "VariantAttributeValue_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantAttributeValue" ADD CONSTRAINT "VariantAttributeValue_attributeDefinitionId_fkey" FOREIGN KEY ("attributeDefinitionId") REFERENCES "AttributeDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BasketItem" ADD CONSTRAINT "BasketItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
