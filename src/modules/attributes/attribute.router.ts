import { Router } from "express";
import { attributeController } from "./attribute.controller";
import { authGuard } from "../../shared/middlewares/auth-guard";
import { adminGuard } from "../../shared/middlewares/admin-guard";
import { validate } from "../../shared/middlewares/validate";
import {
  createAttributeDefinitionSchema,
  updateAttributeDefinitionSchema,
  createAttributeOptionSchema,
  setProductAttributesSchema,
} from "./attribute.schema";

const router = Router();

// ── Definitions par catégorie ─────────────────────────────────────────────────
router.get(
  "/categories/:categoryId/attributes",
  authGuard,
  attributeController.getByCategory,
);

router.post(
  "/categories/:categoryId/attributes",
  authGuard,
  adminGuard,
  validate(createAttributeDefinitionSchema),
  attributeController.createDefinition,
);

router.get(
  "/attributes/:definitionId",
  authGuard,
  attributeController.getDefinitionById,
);

router.patch(
  "/attributes/:definitionId",
  authGuard,
  adminGuard,
  validate(updateAttributeDefinitionSchema),
  attributeController.updateDefinition,
);

router.delete(
  "/attributes/:definitionId",
  authGuard,
  adminGuard,
  attributeController.deleteDefinition,
);

// ── Options ───────────────────────────────────────────────────────────────────
router.post(
  "/attributes/:definitionId/options",
  authGuard,
  adminGuard,
  validate(createAttributeOptionSchema),
  attributeController.createOption,
);

router.delete(
  "/attributes/options/:optionId",
  authGuard,
  adminGuard,
  attributeController.deleteOption,
);

// ── Valeurs produit ───────────────────────────────────────────────────────────
router.put(
  "/product/:productId/attributes",
  authGuard,
  adminGuard,
  validate(setProductAttributesSchema),
  attributeController.setProductAttributes,
);

export default router;
