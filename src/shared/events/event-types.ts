import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ShipmentStatus,
  ReturnStatus,
} from "@prisma/client";

// ─── Payloads ─────────────────────────────────────────────────────────────────

export interface OrderStatusChangedEvent {
  orderId: string;
  userId: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  totalAmount: number;
}

export interface PaymentStatusChangedEvent {
  paymentId: string;
  orderId: string;
  method: PaymentMethod;
  fromStatus: PaymentStatus;
  toStatus: PaymentStatus;
}

export interface ShipmentStatusChangedEvent {
  shipmentId: string;
  orderId: string | null;
  fromStatus: ShipmentStatus;
  toStatus: ShipmentStatus;
}

export interface ReturnStatusChangedEvent {
  returnRequestId: string;
  orderId: string;
  userId: string;
  fromStatus: ReturnStatus;
  toStatus: ReturnStatus;
  items: { orderItemId: string; quantity: number }[];
}

export interface InventoryQuantityChangedEvent {
  inventoryId: string;
  productId: string;
  warehouseId: string;
  combinationId: string | null;
  quantity: number;
}

export interface CombinationDeactivatedEvent {
  productId: string;
  combinationId: string;
  optionsKey: string;
  hadStock: boolean;
  totalQuantity: number;
}

export interface ProductActivatedEvent {
  productId: string;
  categoryId: string;
}

// ─── Catalogue des événements ─────────────────────────────────────────────────

export interface AppEventMap {
  "order.status.changed": OrderStatusChangedEvent;
  "payment.status.changed": PaymentStatusChangedEvent;
  "shipment.status.changed": ShipmentStatusChangedEvent;
  "return.status.changed": ReturnStatusChangedEvent;
  "inventory.quantity.changed": InventoryQuantityChangedEvent;
  "combination.deactivated": CombinationDeactivatedEvent;
  "product.activated": ProductActivatedEvent;
}
