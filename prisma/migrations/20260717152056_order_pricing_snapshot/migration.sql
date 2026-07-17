-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "couponSnapshot" JSONB,
ADD COLUMN     "shippingCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "shippingMethodSnapshot" JSONB;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "discountSnapshot" JSONB;
