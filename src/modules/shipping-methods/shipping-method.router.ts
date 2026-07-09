import { Router } from "express";
import { shippingMethodController } from "./shipping-method.controller";
import { authGuard } from "../../shared/middlewares/auth-guard";
import { adminGuard } from "../../shared/middlewares/admin-guard";
import { optionalAuthGuard } from "../../shared/middlewares/optional-auth-guard";
import { validate } from "../../shared/middlewares/validate";
import {
  createShippingMethodSchema,
  updateShippingMethodSchema,
  calculateShippingSchema,
} from "./shipping-method.schema";

const router = Router();

router.get(
  "/shipping-methods",
  optionalAuthGuard,
  shippingMethodController.getAll,
);
router.get(
  "/shipping-methods/:methodId",
  optionalAuthGuard,
  shippingMethodController.getById,
);
router.post(
  "/shipping-methods",
  authGuard,
  adminGuard,
  validate(createShippingMethodSchema),
  shippingMethodController.create,
);
router.patch(
  "/shipping-methods/:methodId",
  authGuard,
  adminGuard,
  validate(updateShippingMethodSchema),
  shippingMethodController.update,
);
router.delete(
  "/shipping-methods/:methodId",
  authGuard,
  adminGuard,
  shippingMethodController.delete,
);
router.post(
  "/shipping-methods/calculate",
  validate(calculateShippingSchema),
  shippingMethodController.calculate,
);

export default router;
