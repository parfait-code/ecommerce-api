import { Router } from "express";
import { settingController } from "./setting.controller";
import { authGuard } from "../../shared/middlewares/auth-guard";
import { adminGuard } from "../../shared/middlewares/admin-guard";
import { validate } from "../../shared/middlewares/validate";
import {
  updateSettingSchema,
  updateManySettingsSchema,
} from "./setting.schema";

const router = Router();

// Publique — le frontend récupère devise, pays supportés, méthodes de
// paiement actives, etc. sans authentification (nécessaire dès la home page).
router.get("/settings/public", settingController.getPublic);

router.get("/settings", authGuard, adminGuard, settingController.getAll);

router.patch(
  "/settings",
  authGuard,
  adminGuard,
  validate(updateManySettingsSchema),
  settingController.updateMany,
);

router.patch(
  "/settings/:key",
  authGuard,
  adminGuard,
  validate(updateSettingSchema),
  settingController.update,
);

export default router;
