import { Router } from "express";
import { promotionController } from "./promotion.controller";
import { authGuard } from "../../shared/middlewares/auth-guard";
import { adminGuard } from "../../shared/middlewares/admin-guard";
import { validate } from "../../shared/middlewares/validate";
import { upload } from "../../shared/middlewares/multer";
import {
  createPromotionSchema,
  updatePromotionSchema,
  createDiscountSchema,
  createCouponSchema,
  validateCouponSchema,
} from "./promotion.schema";

const router = Router();

// ── Promotions ────────────────────────────────────────────────────────────────
router.get("/promotions", authGuard, adminGuard, promotionController.getAll);
router.get("/promotions/slug/:slug", promotionController.getBySlug);
router.get(
  "/promotions/:promotionId",
  authGuard,
  adminGuard,
  promotionController.getById,
);
router.post(
  "/promotions",
  authGuard,
  adminGuard,
  validate(createPromotionSchema),
  promotionController.create,
);
router.put(
  "/promotions/:promotionId",
  authGuard,
  adminGuard,
  validate(updatePromotionSchema),
  promotionController.update,
);
router.patch(
  "/promotions/:promotionId/toggle",
  authGuard,
  adminGuard,
  promotionController.toggle,
);
router.delete(
  "/promotions/:promotionId",
  authGuard,
  adminGuard,
  promotionController.delete,
);
router.post(
  "/promotions/:promotionId/images",
  authGuard,
  adminGuard,
  upload.array("images", 5),
  promotionController.uploadImages,
);
router.delete(
  "/promotions/:promotionId/images",
  authGuard,
  adminGuard,
  promotionController.deleteImage,
);

// ── Discounts ─────────────────────────────────────────────────────────────────
router.post(
  "/promotions/:promotionId/discounts",
  authGuard,
  adminGuard,
  validate(createDiscountSchema),
  promotionController.createDiscount,
);
router.delete(
  "/promotions/:promotionId/discounts/:discountId",
  authGuard,
  adminGuard,
  promotionController.deleteDiscount,
);

// ── Coupons ───────────────────────────────────────────────────────────────────
router.get(
  "/promotions/:promotionId/coupons",
  authGuard,
  adminGuard,
  promotionController.getCoupons,
);
router.post(
  "/promotions/:promotionId/coupons",
  authGuard,
  adminGuard,
  validate(createCouponSchema),
  promotionController.createCoupon,
);
router.delete(
  "/promotions/:promotionId/coupons/:couponId",
  authGuard,
  adminGuard,
  promotionController.deleteCoupon,
);
router.post(
  "/coupons/validate",
  authGuard,
  validate(validateCouponSchema),
  promotionController.validateCoupon,
);

export default router;
