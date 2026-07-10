import { Router } from "express";
import { shipmentController } from "./shipment.controller";
import { authGuard } from "../../shared/middlewares/auth-guard";
import { adminGuard } from "../../shared/middlewares/admin-guard";
import { validate } from "../../shared/middlewares/validate";
import {
  createShipmentSchema,
  trackingEventSchema,
  updateShipmentStatusSchema,
  shippingCostSchema,
} from "./shipment.schema";

const router = Router();

router.post(
  "/shipments/cost",
  validate(shippingCostSchema),
  shipmentController.calculateCost,
);
router.post(
  "/shipments",
  authGuard,
  adminGuard,
  validate(createShipmentSchema),
  shipmentController.create,
);
router.get("/shipments/:shipmentId", authGuard, shipmentController.getById);
router.get("/shipments", authGuard, adminGuard, shipmentController.getAll);
// Corrigé — action transporteur/opérationnelle, réservée admin (comme updateStatus)
router.post(
  "/shipments/:shipmentId/track",
  authGuard,
  adminGuard,
  validate(trackingEventSchema),
  shipmentController.addTrackingEvent,
);
router.get(
  "/shipments/:shipmentId/track",
  authGuard,
  shipmentController.getTracking,
);
router.put(
  "/shipments/:shipmentId/status",
  authGuard,
  adminGuard,
  validate(updateShipmentStatusSchema),
  shipmentController.updateStatus,
);
router.post(
  "/shipments/:shipmentId/cancel",
  authGuard,
  shipmentController.cancel,
);
router.get("/labels/:shipmentId", authGuard, shipmentController.getLabel);

router.get(
  "/orders/:orderId/shipment",
  authGuard,
  shipmentController.getByOrder,
);

export default router;
