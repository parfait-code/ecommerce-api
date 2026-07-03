import { Router } from "express";
import { paymentController } from "./payment.controller";
import { authGuard } from "../../shared/middlewares/auth-guard";
import { adminGuard } from "../../shared/middlewares/admin-guard";
import { validate } from "../../shared/middlewares/validate";
import { createPaymentSchema } from "./payment.schema";

const router = Router();

router.get("/payment-methods", paymentController.getMethods);
router.post(
  "/payments",
  authGuard,
  validate(createPaymentSchema),
  paymentController.create,
);
router.get("/payments/:payment_id", authGuard, paymentController.getById);
router.put(
  "/payments/:payment_id/complete",
  authGuard,
  adminGuard,
  paymentController.complete,
);
router.get(
  "/orders/:orderId/payments",
  authGuard,
  paymentController.getByOrderId,
);
router.get("/payments", authGuard, adminGuard, paymentController.getAll);

export default router;
