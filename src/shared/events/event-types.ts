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
  userId: number;
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
  userId: number;
  fromStatus: ReturnStatus;
  toStatus: ReturnStatus;
  items: { orderItemId: string; quantity: number }[];
}

// ─── Catalogue des événements ─────────────────────────────────────────────────
// Ajouter une nouvelle ligne ici pour chaque nouvel événement (ex: pour les
// recommandations S1-S4 du guide Product/Attributs/Combinaisons/Stock).

export interface AppEventMap {
  "order.status.changed": OrderStatusChangedEvent;
  "payment.status.changed": PaymentStatusChangedEvent;
  "shipment.status.changed": ShipmentStatusChangedEvent;
  "return.status.changed": ReturnStatusChangedEvent;
}
