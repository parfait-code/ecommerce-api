import { Router } from "express";
import { categoryController } from "./category.controller";
import { authGuard } from "../../shared/middlewares/auth-guard";
import { optionalAuthGuard } from "../../shared/middlewares/optional-auth-guard";
import { adminGuard } from "../../shared/middlewares/admin-guard";
import { validate } from "../../shared/middlewares/validate";
import { upload } from "../../shared/middlewares/multer";
import { createCategorySchema, updateCategorySchema } from "./category.schema";

const router = Router();

router.get("/categories", optionalAuthGuard, categoryController.getAll);
router.get(
  "/categories/:categoryId",
  optionalAuthGuard,
  categoryController.getById,
);
router.get("/categories/slug/:slug", categoryController.getBySlug);
router.get(
  "/categories/slug/:slug/products",
  optionalAuthGuard,
  categoryController.getProducts,
);
router.post(
  "/categories",
  authGuard,
  adminGuard,
  validate(createCategorySchema),
  categoryController.create,
);
router.put(
  "/categories/:categoryId",
  authGuard,
  adminGuard,
  validate(updateCategorySchema),
  categoryController.update,
);
router.delete(
  "/categories/:categoryId",
  authGuard,
  adminGuard,
  categoryController.delete,
);

// ── Upload image / icône (aligné sur le comportement produit) ────────────────
// multipart/form-data, champs "image" et/ou "icon" (1 fichier chacun max)
router.post(
  "/categories/:categoryId/assets",
  authGuard,
  adminGuard,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "icon", maxCount: 1 },
  ]),
  categoryController.uploadAssets,
);
router.delete(
  "/categories/:categoryId/image",
  authGuard,
  adminGuard,
  categoryController.deleteImage,
);
router.delete(
  "/categories/:categoryId/icon",
  authGuard,
  adminGuard,
  categoryController.deleteIcon,
);

export default router;
