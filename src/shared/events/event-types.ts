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
  userId: number;
  fromStatus: ReturnStatus;
  toStatus: ReturnStatus;
  items: { orderItemId: string; quantity: number }[];
}

/**
 * Émis après CHAQUE mutation de quantité en stock, quel que soit l'appelant
 * (ajustement manuel admin, transfert entre entrepôts, réservation FIFO à la
 * commande, restitution au retour/annulation). C'est le point de centralisation
 * qui répond à S1 du guide Product/Attributs/Combinaisons/Stock : avant cet
 * événement, seul l'ajustement manuel déclenchait une alerte LOW_STOCK/OUT_OF_STOCK.
 */
export interface InventoryQuantityChangedEvent {
  inventoryId: string;
  productId: number;
  warehouseId: string;
  combinationId: string | null;
  quantity: number;
}

/**
 * Émis quand une ProductCombination passe à isActive:false (manuellement via
 * PATCH, ou automatiquement via generate()) alors qu'elle a encore du stock
 * actif dessus. Répond à S3.
 */
export interface CombinationDeactivatedEvent {
  productId: string;
  combinationId: string;
  optionsKey: string;
  hadStock: boolean;
  totalQuantity: number;
}

/**
 * Émis quand un Product passe à ACTIVE. Répond à S4 : le listener vérifie
 * qu'au moins une combinaison active existe si la catégorie a des attributs
 * de variante, et avertit (non bloquant) sinon.
 */
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
