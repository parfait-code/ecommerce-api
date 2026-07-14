import { Router } from "express";
import { popupController } from "./popup.controller";
import { authGuard } from "../../shared/middlewares/auth-guard";
import { adminGuard } from "../../shared/middlewares/admin-guard";
import { validate } from "../../shared/middlewares/validate";
import { upload } from "../../shared/middlewares/multer";
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

// ── Upload / suppression d'image (multipart, champ "image") ────────────
router.post(
  "/popups/:popupId/image",
  authGuard,
  adminGuard,
  upload.single("image"),
  popupController.uploadImage,
);
router.delete(
  "/popups/:popupId/image",
  authGuard,
  adminGuard,
  popupController.deleteImage,
);

export default router;