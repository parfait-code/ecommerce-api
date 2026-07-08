-- DropForeignKey
ALTER TABLE "Inventory" DROP CONSTRAINT "Inventory_combinationId_fkey";

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_combinationId_fkey" FOREIGN KEY ("combinationId") REFERENCES "ProductCombination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
