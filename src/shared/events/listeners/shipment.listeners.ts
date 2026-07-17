import { OrderStatus, ShipmentStatus } from "@prisma/client";
import { eventBus } from "../event-bus";
import { orderService } from "../../../modules/orders/order.service";
import { shipmentRepository } from "../../../modules/shipments/shipment.repository";
import { systemLogger } from "../../logger";

const SHIPMENT_TO_ORDER_STATUS: Partial<Record<ShipmentStatus, OrderStatus>> = {
  IN_TRANSIT: OrderStatus.SHIPPED,
  DELIVERED: OrderStatus.DELIVERED,
};

export const registerShipmentEventListeners = (): void => {
  eventBus.on("shipment.status.changed", async (payload) => {
    if (!payload.orderId) return;

    const mappedStatus = SHIPMENT_TO_ORDER_STATUS[payload.toStatus];
    if (!mappedStatus) return;

    try {
      await orderService.updateStatus(
        payload.orderId,
        {
          status: mappedStatus,
          reason: `Auto-synced from shipment status change to ${payload.toStatus}`,
        },
        null,
        "SYSTEM",
      );
    } catch (err) {
      systemLogger.error("ORDER_SYNC_FAILED", {
        service: "shipment-listeners",
        metadata: {
          orderId: payload.orderId,
          shipmentId: payload.shipmentId,
          shipmentStatus: payload.toStatus,
          targetOrderStatus: mappedStatus,
          error: (err as Error).message,
        },
      });
    }
  });

  // Nouveau — symétrique à la sync Shipment→Order ci-dessus : si une
  // commande est annulée (manuellement ou via order-expiration.job) alors
  // qu'une expédition existe déjà et n'est pas dans un état terminal, cette
  // expédition restait PENDING/IN_TRANSIT indéfiniment. On l'annule.
  // CANCELLED n'étant pas dans SHIPMENT_TO_ORDER_STATUS, aucun risque de
  // boucle avec le listener ci-dessus.
  eventBus.on("order.status.changed", async (payload) => {
    if (payload.toStatus !== OrderStatus.CANCELLED) return;

    try {
      const shipment = await shipmentRepository.findByOrderId(payload.orderId);
      if (!shipment) return;
      if (shipment.status === "CANCELLED" || shipment.status === "DELIVERED")
        return;

      await shipmentRepository.updateStatus(shipment.id, "CANCELLED");
    } catch (err) {
      systemLogger.error("ORDER_SYNC_FAILED", {
        service: "shipment-listeners",
        metadata: {
          orderId: payload.orderId,
          reason: "Failed to auto-cancel shipment on order cancellation",
          error: (err as Error).message,
        },
      });
    }
  });
};
