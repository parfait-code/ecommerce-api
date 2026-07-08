import { Router } from "express";
import { productController } from "./product.controller";
import { authGuard } from "../../shared/middlewares/auth-guard";
import { optionalAuthGuard } from "../../shared/middlewares/optional-auth-guard";
import { adminGuard } from "../../shared/middlewares/admin-guard";
import { validate } from "../../shared/middlewares/validate";
import { createProductSchema, updateProductSchema } from "./product.schema";
import { upload } from "../../shared/middlewares/multer";

const router = Router();

router.get("/product", optionalAuthGuard, productController.getAll);
router.get("/product/:productId", optionalAuthGuard, productController.getById);
router.post(
  "/product",
  authGuard,
  adminGuard,
  validate(createProductSchema),
  productController.create,
);
router.patch(
  "/product/:productId",
  authGuard,
  adminGuard,
  validate(updateProductSchema),
  productController.update,
);
router.delete(
  "/product/:productId",
  authGuard,
  adminGuard,
  productController.delete,
);
router.post(
  "/product/:productId/images",
  authGuard,
  adminGuard,
  upload.array("images", 5),
  productController.uploadImages,
);
router.delete(
  "/product/:productId/images",
  authGuard,
  adminGuard,
  productController.deleteImage,
);

export default router;
