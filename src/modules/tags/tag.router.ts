import { Router } from "express";
import { tagController } from "./tag.controller";
import { authGuard } from "../../shared/middlewares/auth-guard";
import { adminGuard } from "../../shared/middlewares/admin-guard";
import { validate } from "../../shared/middlewares/validate";
import {
  createTagSchema,
  updateTagSchema,
  setProductTagsSchema,
} from "./tag.schema";

const router = Router();

router.get("/tags", tagController.getAll);
router.get("/tags/:tagId", tagController.getById);
router.post(
  "/tags",
  authGuard,
  adminGuard,
  validate(createTagSchema),
  tagController.create,
);
router.patch(
  "/tags/:tagId",
  authGuard,
  adminGuard,
  validate(updateTagSchema),
  tagController.update,
);
router.delete("/tags/:tagId", authGuard, adminGuard, tagController.delete);
router.put(
  "/product/:productId/tags",
  authGuard,
  adminGuard,
  validate(setProductTagsSchema),
  tagController.setProductTags,
);
router.get("/product/:productId/tags", tagController.getByProduct);

export default router;
