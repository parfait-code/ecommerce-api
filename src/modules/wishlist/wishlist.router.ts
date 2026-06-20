import { Router } from "express";
import { wishlistController } from "./wishlist.controller";
import { authGuard } from "../../shared/middlewares/auth-guard";
import { validate } from "../../shared/middlewares/validate";
import {
  addWishlistItemSchema,
  removeWishlistItemSchema,
} from "./wishlist.schema";

const router = Router();

router.get("/wishlist", authGuard, wishlistController.getByUser);
router.post(
  "/wishlist/items",
  authGuard,
  validate(addWishlistItemSchema),
  wishlistController.addItem,
);
router.delete(
  "/wishlist/items",
  authGuard,
  validate(removeWishlistItemSchema),
  wishlistController.removeItem,
);

export default router;
