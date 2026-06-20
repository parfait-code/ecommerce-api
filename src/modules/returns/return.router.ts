import { Router } from "express";
import { returnController } from "./return.controller";
import { authGuard } from "../../shared/middlewares/auth-guard";
import { adminGuard } from "../../shared/middlewares/admin-guard";
import { validate } from "../../shared/middlewares/validate";
import { createReturnSchema, updateReturnStatusSchema } from "./return.schema";

const router = Router();

router.get("/returns", authGuard, adminGuard, returnController.getAll);
router.get("/returns/:returnId", authGuard, returnController.getById);
router.post(
  "/returns",
  authGuard,
  validate(createReturnSchema),
  returnController.create,
);
router.put(
  "/returns/:returnId/status",
  authGuard,
  adminGuard,
  validate(updateReturnStatusSchema),
  returnController.updateStatus,
);
router.get("/orders/:orderId/returns", authGuard, returnController.getByOrder);

export default router;
