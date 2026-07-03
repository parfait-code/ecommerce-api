import { Router } from "express";
import { combinationController } from "./combination.controller";
import { authGuard } from "../../shared/middlewares/auth-guard";
import { adminGuard } from "../../shared/middlewares/admin-guard";
import { validate } from "../../shared/middlewares/validate";
import {
  setVariantOptionsSchema,
  updateCombinationSchema,
} from "./combination.schema";

const router = Router({ mergeParams: true });

router.get("/", authGuard, combinationController.getByProduct);
router.get("/selections", authGuard, combinationController.getSelections);
router.put(
  "/selections/:attributeDefinitionId",
  authGuard,
  adminGuard,
  validate(setVariantOptionsSchema),
  combinationController.setOptionsForAttribute,
);
router.post("/generate", authGuard, adminGuard, combinationController.generate);
router.get("/:combinationId", authGuard, combinationController.getById);
router.patch(
  "/:combinationId",
  authGuard,
  adminGuard,
  validate(updateCombinationSchema),
  combinationController.update,
);
router.delete(
  "/:combinationId",
  authGuard,
  adminGuard,
  combinationController.delete,
);

export default router;
