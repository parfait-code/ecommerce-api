import { Router } from "express";
import { variantController } from "./variant.controller";
import { authGuard } from "../../shared/middlewares/auth-guard";
import { adminGuard } from "../../shared/middlewares/admin-guard";
import { validate } from "../../shared/middlewares/validate";
import { createVariantSchema, updateVariantSchema } from "./variant.schema";

const router = Router({ mergeParams: true });

router.get("/", authGuard, variantController.getByProduct);
router.get("/:variantId", authGuard, variantController.getById);
router.post(
  "/",
  authGuard,
  adminGuard,
  validate(createVariantSchema),
  variantController.create,
);
router.patch(
  "/:variantId",
  authGuard,
  adminGuard,
  validate(updateVariantSchema),
  variantController.update,
);
router.delete("/:variantId", authGuard, adminGuard, variantController.delete);

export default router;
