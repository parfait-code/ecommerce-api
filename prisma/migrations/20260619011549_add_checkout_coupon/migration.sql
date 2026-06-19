-- AlterTable
ALTER TABLE "Checkout" ADD COLUMN     "couponCodeId" TEXT;

-- AddForeignKey
ALTER TABLE "Checkout" ADD CONSTRAINT "Checkout_couponCodeId_fkey" FOREIGN KEY ("couponCodeId") REFERENCES "CouponCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
