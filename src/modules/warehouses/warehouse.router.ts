import { Router } from "express";
import { warehouseController } from "./warehouse.controller";
import { authGuard } from "../../shared/middlewares/auth-guard";
import { adminGuard } from "../../shared/middlewares/admin-guard";
import { validate } from "../../shared/middlewares/validate";
import {
  createWarehouseSchema,
  updateWarehouseSchema,
} from "./warehouse.schema";

const router = Router();

router.get("/warehouses", authGuard, adminGuard, warehouseController.getAll);
router.get(
  "/warehouses/:warehouse_id",
  authGuard,
  adminGuard,
  warehouseController.getById,
);
router.get(
  "/warehouses/:warehouse_id/inventory",
  authGuard,
  adminGuard,
  warehouseController.getInventory,
);
router.post(
  "/warehouses",
  authGuard,
  adminGuard,
  validate(createWarehouseSchema),
  warehouseController.create,
);
router.put(
  "/warehouses/:warehouse_id",
  authGuard,
  adminGuard,
  validate(updateWarehouseSchema),
  warehouseController.update,
);
router.delete(
  "/warehouses/:warehouse_id",
  authGuard,
  adminGuard,
  warehouseController.delete,
);

export default router;
