import { Router } from "express";
import { basketController } from "./basket.controller";
import { authGuard } from "../../shared/middlewares/auth-guard";
import { validate } from "../../shared/middlewares/validate";
import {
  addProductSchema,
  updateQuantitySchema,
  removeProductSchema,
} from "./basket.schema";

const router = Router();

// Nouveau — panier unique de l'utilisateur, get-or-create
router.get("/user/basket", authGuard, basketController.getMine);

router.post("/basket", authGuard, basketController.create);
router.get("/basket/:basket_id", authGuard, basketController.getById);
router.post(
  "/basket/:basket_id/product",
  authGuard,
  validate(addProductSchema),
  basketController.addProduct,
);
router.put(
  "/basket/:basket_id/product/quantity",
  authGuard,
  validate(updateQuantitySchema),
  basketController.updateQuantity,
);
router.delete(
  "/basket/:basket_id/product",
  authGuard,
  validate(removeProductSchema),
  basketController.removeProduct,
);

export default router;
