import { Router } from "express";
import { popupController } from "./popup.controller";
import { authGuard } from "../../shared/middlewares/auth-guard";
import { adminGuard } from "../../shared/middlewares/admin-guard";
import { validate } from "../../shared/middlewares/validate";
import { createPopupSchema, updatePopupSchema } from "./popup.schema";

const router = Router();

// Publique — pop-ups actifs à l'instant T, lien déjà résolu (resolvedUrl)
router.get("/popups/active", popupController.getActive);

router.get("/popups", authGuard, adminGuard, popupController.getAll);
router.get("/popups/:popupId", authGuard, adminGuard, popupController.getById);
router.post(
  "/popups",
  authGuard,
  adminGuard,
  validate(createPopupSchema),
  popupController.create,
);
router.put(
  "/popups/:popupId",
  authGuard,
  adminGuard,
  validate(updatePopupSchema),
  popupController.update,
);
router.delete(
  "/popups/:popupId",
  authGuard,
  adminGuard,
  popupController.delete,
);

export default router;
