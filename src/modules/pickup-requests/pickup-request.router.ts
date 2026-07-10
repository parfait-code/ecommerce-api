import { Router } from "express";
import { pickupRequestController } from "./pickup-request.controller";
import { authGuard } from "../../shared/middlewares/auth-guard";
import { adminGuard } from "../../shared/middlewares/admin-guard";
import { validate } from "../../shared/middlewares/validate";
import {
  updatePickupLocationSchema,
  updatePickupStatusSchema,
} from "./pickup-request.schema";

const router = Router();

// Pas de POST — une pickup request naît exclusivement de l'approbation
// d'un retour (return.service.ts::updateStatus).
router.get(
  "/pickup-requests",
  authGuard,
  adminGuard,
  pickupRequestController.getAll,
);
router.get(
  "/pickup-requests/:requestId",
  authGuard,
  pickupRequestController.getById,
);

router.patch(
  "/pickup-requests/:requestId/location",
  authGuard,
  adminGuard,
  validate(updatePickupLocationSchema),
  pickupRequestController.updateLocation,
);
router.patch(
  "/pickup-requests/:requestId/status",
  authGuard,
  adminGuard,
  validate(updatePickupStatusSchema),
  pickupRequestController.updateStatus,
);

// Cible pour un cron externe — voir note dans pickup-request.service.ts.
router.post(
  "/pickup-requests/expire-overdue",
  authGuard,
  adminGuard,
  pickupRequestController.expireOverdue,
);

export default router;
