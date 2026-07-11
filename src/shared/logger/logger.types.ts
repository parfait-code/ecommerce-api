// ─── Actor ───────────────────────────────────────────────────────────────────

export type ActorRole =
  | "CUSTOMER"
  | "ADMIN"
  | "SUPER_ADMIN"
  | "ANONYMOUS"
  | "UNKNOWN"
  | "SYSTEM";

export interface Actor {
  userId: string | number | null;
  email?: string | null;
  role: ActorRole;
  ip?: string | null;
  userAgent?: string | null;
}

// ─── Target ──────────────────────────────────────────────────────────────────

export interface Target {
  userId?: string | number;
  orderId?: string;
  productId?: string | number;
  paymentId?: string;
  shipmentId?: string;
  basketId?: string;
  inventoryId?: string;
  warehouseId?: string;
  reviewId?: string;
  addressId?: string;
  pickupRequestId?: string;
  categoryId?: string;
  promotionId?: string;
  discountId?: string;
  couponId?: string;
  returnRequestId?: string;
  [key: string]: unknown;
}

// ─── Log Entry (schéma universel section 9) ───────────────────────────────────

export interface LogEntry {
  timestamp?: string;
  level?: string;
  service: string;
  event: string;
  requestId?: string | null;
  actor?: Actor;
  target?: Target;
  metadata?: Record<string, unknown>;
}

// ─── Request Context (section 8) ─────────────────────────────────────────────

export interface RequestContext {
  requestId: string;
  userId: string | number | null;
  email: string | null;
  role: ActorRole;
  ip: string;
  userAgent: string;
}

// ─── Business Events ──────────────────────────────────────────────────────────

export type AuthEvent =
  | "USER_REGISTERED"
  | "USER_LOGIN"
  | "USER_LOGOUT"
  | "PASSWORD_RESET_REQUESTED"
  | "PASSWORD_RESET_COMPLETED"
  | "EMAIL_VERIFIED";

export type ProductEvent =
  | "PRODUCT_CREATED"
  | "PRODUCT_UPDATED"
  | "PRODUCT_DELETED";

export type OrderEvent =
  | "ORDER_CREATED"
  | "ORDER_CONFIRMED"
  | "ORDER_CANCELLED"
  | "ORDER_COMPLETED"
  | "ORDER_STATUS_CHANGED";

export type PaymentEvent =
  | "PAYMENT_INITIATED"
  | "PAYMENT_SUCCESS"
  | "PAYMENT_FAILED"
  | "PAYMENT_REFUNDED"
  | "WEBHOOK_RECEIVED"
  | "WEBHOOK_REJECTED";

export type InventoryEvent =
  | "STOCK_RESERVED"
  | "STOCK_RELEASED"
  | "LOW_STOCK"
  | "OUT_OF_STOCK"
  | "STOCK_ADDED"
  | "STOCK_REMOVED"
  | "STOCK_TRANSFERRED"
  | "STOCK_ADJUSTED";

export type ShipmentEvent =
  | "SHIPMENT_CREATED"
  | "SHIPMENT_SENT"
  | "SHIPMENT_DELIVERED"
  | "SHIPMENT_FAILED";

export type UserEvent =
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_DELETED"
  | "ROLE_CHANGED"
  | "ACCOUNT_LOCKED"
  | "ACCOUNT_UNLOCKED";

export type WarehouseEvent =
  | "WAREHOUSE_CREATED"
  | "WAREHOUSE_UPDATED"
  | "WAREHOUSE_DELETED";

export type ReviewEvent =
  | "REVIEW_CREATED"
  | "REVIEW_UPDATED"
  | "REVIEW_DELETED";

export type AddressEvent =
  | "ADDRESS_CREATED"
  | "ADDRESS_UPDATED"
  | "ADDRESS_DELETED";

export type ReturnEvent =
  | "RETURN_REQUESTED"
  | "RETURN_APPROVED"
  | "RETURN_REJECTED"
  | "RETURN_CANCELLED"
  | "RETURN_COMPLETED";

export type CategoryEvent =
  | "CATEGORY_CREATED"
  | "CATEGORY_UPDATED"
  | "CATEGORY_DELETED";

export type PromotionEvent =
  | "PROMOTION_CREATED"
  | "PROMOTION_UPDATED"
  | "PROMOTION_TOGGLED"
  | "PROMOTION_DELETED";

export type DiscountEvent = "DISCOUNT_CREATED" | "DISCOUNT_DELETED";

export type CouponEvent =
  | "COUPON_CREATED"
  | "COUPON_DELETED"
  | "COUPON_APPLIED"
  | "COUPON_USAGE_RECORDED";

export type WishlistEvent = "WISHLIST_ITEM_ADDED" | "WISHLIST_ITEM_REMOVED";

export type PickupEvent =
  | "PICKUP_REQUEST_CREATED"
  | "PICKUP_LOCATION_UPDATED"
  | "PICKUP_STATUS_CHANGED";

export type BusinessEvent =
  | AuthEvent
  | ProductEvent
  | OrderEvent
  | PaymentEvent
  | InventoryEvent
  | ShipmentEvent
  | UserEvent
  | WarehouseEvent
  | ReviewEvent
  | AddressEvent
  | ReturnEvent
  | CategoryEvent
  | PromotionEvent
  | DiscountEvent
  | CouponEvent
  | WishlistEvent
  | PickupEvent;

// ─── Audit Events (section 14) ────────────────────────────────────────────────

export type AuditEvent =
  | "PRODUCT_CREATED"
  | "PRODUCT_UPDATED"
  | "PRODUCT_DELETED"
  | "PRICE_CHANGED"
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_DELETED"
  | "ROLE_CHANGED"
  | "ACCOUNT_LOCKED"
  | "ACCOUNT_UNLOCKED"
  | "STOCK_ADDED"
  | "STOCK_REMOVED"
  | "STOCK_TRANSFERRED"
  | "STOCK_ADJUSTED"
  | "PAYMENT_APPROVED"
  | "PAYMENT_REFUNDED"
  | "PAYMENT_CANCELLED"
  | "ORDER_CANCELLED"
  | "ORDER_STATUS_CHANGED"
  | "ORDER_REFUNDED"
  | "PROMOTION_CREATED"
  | "PROMOTION_TOGGLED"
  | "PROMOTION_DELETED"
  | "COUPON_APPLIED"
  | "DISCOUNT_CREATED"
  | "CATEGORY_CREATED"
  | "CATEGORY_UPDATED"
  | "CATEGORY_DELETED"
  | "SETTINGS_UPDATED";

// ─── Security Events (section 16) ────────────────────────────────────────────

export type SecurityEvent =
  | "FAILED_LOGIN"
  | "MULTIPLE_FAILED_LOGINS"
  | "BRUTE_FORCE_DETECTED"
  | "INVALID_JWT"
  | "TOKEN_TAMPERING"
  | "RATE_LIMIT_EXCEEDED"
  | "FORBIDDEN_ACCESS"
  | "UNAUTHORIZED_ACCESS"
  | "WEBHOOK_SIGNATURE_INVALID"
  | "SUSPICIOUS_ACTIVITY";

// ─── System Events (section 6) ───────────────────────────────────────────────

export type SystemEvent =
  | "SERVER_STARTED"
  | "SERVER_STOPPED"
  | "DATABASE_CONNECTED"
  | "DATABASE_ERROR"
  | "REDIS_CONNECTED"
  | "REDIS_ERROR"
  | "CACHE_HIT"
  | "CACHE_MISS"
  | "CACHE_ERROR"
  | "ORDER_SYNC_FAILED"
  | "EVENT_LISTENER_FAILED"
  | "COMBINATION_DEACTIVATED_WITH_STOCK"
  | "PRODUCT_ACTIVATED_WITHOUT_COMBINATIONS"
  | "PICKUP_REQUEST_EXPIRED"
  | "PICKUP_EXPIRATION_JOB_STARTED"
  | "PICKUP_EXPIRATION_JOB_RAN"
  | "PICKUP_EXPIRATION_JOB_FAILED"
  | "ORDER_EXPIRATION_JOB_STARTED"
  | "ORDER_EXPIRATION_JOB_RAN"
  | "ORDER_EXPIRATION_JOB_FAILED"
  | "SETTINGS_REFRESH_JOB_STARTED"
  | "SETTINGS_REFRESH_JOB_FAILED";

// ─── Error Events ────────────────────────────────────────────────────────────

export type ErrorEvent =
  | "DATABASE_ERROR"
  | "PAYMENT_PROVIDER_ERROR"
  | "WEBHOOK_ERROR"
  | "UNHANDLED_ERROR"
  | "VALIDATION_ERROR"
  | "NOT_FOUND_ERROR"
  | "FORBIDDEN_ERROR"
  | "INTERNAL_ERROR";
