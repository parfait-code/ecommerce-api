import { OrderStatus, ShipmentStatus } from "@prisma/client";
import { eventBus } from "../event-bus";
import { pickupRepository } from "../../../modules/shipments/shipment.repository";
import { systemLogger } from "../../logger";

/**
 * T4 — quand une Order ou un Shipment passe à CANCELLED, les PickupRequest
 * liés (via orderId/shipmentId) restés PENDING ne suivaient jamais cette
 * annulation, malgré les FK déjà présentes dans le schéma. Ce listener
 * ferme cette lacune, sur le même modèle que shipment.listeners.ts (R5 :
 * jamais d'échec avalé silencieusement).
 */
export const registerPickupEventListeners = (): void => {
  eventBus.on("order.status.changed", async (payload) => {
    if (payload.toStatus !== OrderStatus.CANCELLED) return;

    try {
      const pending = await pickupRepository.findPendingByOrder(
        payload.orderId,
      );
      for (const request of pending) {
        await pickupRepository.cancel(request.id);
      }
    } catch (err) {
      systemLogger.error("ORDER_SYNC_FAILED", {
        service: "pickup-listeners",
        metadata: {
          orderId: payload.orderId,
          reason: "Failed to cancel pickup requests on order cancellation",
          error: (err as Error).message,
        },
      });
    }
  });

  eventBus.on("shipment.status.changed", async (payload) => {
    if (payload.toStatus !== ShipmentStatus.CANCELLED) return;

    try {
      const pending = await pickupRepository.findPendingByShipment(
        payload.shipmentId,
      );
      for (const request of pending) {
        await pickupRepository.cancel(request.id);
      }
    } catch (err) {
      systemLogger.error("ORDER_SYNC_FAILED", {
        service: "pickup-listeners",
        metadata: {
          shipmentId: payload.shipmentId,
          reason: "Failed to cancel pickup requests on shipment cancellation",
          error: (err as Error).message,
        },
      });
    }
  });
};
