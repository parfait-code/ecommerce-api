/**
 * Logger Index
 * Point d'entrée unique pour toute l'application.
 * Remplace l'ancien src/shared/config/logger.ts
 *
 * Usage :
 *   import { businessLogger, auditLogger, securityLogger, ... } from '@/shared/config/logger'
 */

export { accessLogger } from "./access.logger";
export { businessLogger } from "./business.logger";
export { auditLogger } from "./audit.logger";
export { securityLogger } from "./security.logger";
export { errorLogger } from "./error.logger";
export { systemLogger } from "./system.logger";

// Ré-export des types pour éviter des imports profonds dans les modules
export type {
  Actor,
  ActorRole,
  Target,
  LogEntry,
  RequestContext,
  BusinessEvent,
  AuditEvent,
  SecurityEvent,
  SystemEvent,
  ErrorEvent,
  AuthEvent,
  ProductEvent,
  BasketEvent,
  CheckoutEvent,
  OrderEvent,
  PaymentEvent,
  InventoryEvent,
  ShipmentEvent,
  UserEvent,
  WarehouseEvent,
  ReviewEvent,
  AddressEvent,
  WishlistEvent,
} from "./logger.types";
