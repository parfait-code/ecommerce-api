import { OrderStatus, ShipmentStatus } from "@prisma/client";
import { eventBus } from "../event-bus";
import { orderService } from "../../../modules/orders/order.service";
import { systemLogger } from "../../logger";

// Anciennement dans shipment.service.ts::syncOrderStatus — déplacé ici pour
// découpler le domaine "shipments" du domaine "orders".
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
      // R5 — on ne l'avale JAMAIS silencieusement : log explicite avec tout
      // le contexte nécessaire pour investiguer (ex: Order.status et
      // Shipment.status qui divergent car la transition était invalide).
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
};
