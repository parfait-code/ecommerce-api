import { Router } from "express";
import { loyaltyController } from "./loyalty.controller";
import { authGuard } from "../../shared/middlewares/auth-guard";
import { adminGuard } from "../../shared/middlewares/admin-guard";
import { validate } from "../../shared/middlewares/validate";
import { adjustLoyaltySchema } from "./loyalty.schema";

const router = Router();

router.get("/loyalty/:userId/balance", authGuard, loyaltyController.getBalance);
router.get("/loyalty/:userId/history", authGuard, loyaltyController.getHistory);
router.post(
  "/loyalty/adjust",
  authGuard,
  adminGuard,
  validate(adjustLoyaltySchema),
  loyaltyController.adjust,
);

export default router;
