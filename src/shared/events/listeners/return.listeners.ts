import { PaymentStatus, ReturnStatus } from "@prisma/client";
import { eventBus } from "../event-bus";
import { paymentRepository } from "../../../modules/payments/payment.repository";
import { paymentService } from "../../../modules/payments/payment.service";
import { orderReservationRepository } from "../../../modules/orders/order.repository";
import { inventoryRepository } from "../../../modules/inventory/inventory.repository";
import { loyaltyService } from "../../../modules/loyalty/loyalty.service";
import { systemLogger } from "../../logger";

/**
 * R3 — Réintégration du stock via OrderItemReservation.
 * Simplification assumée (cf. status_management_guide.md §4/§7) :
 * on redistribue la quantité retournée sur les réservations existantes
 * de cet orderItem, dans leur ordre d'attribution, sans tracer combien
 * a déjà été rendu par des retours partiels antérieurs sur le même item.
 * À affiner si les retours partiels multiples sur un même orderItem
 * deviennent un cas réel.
 */
const reintegrateStockForOrderItem = async (
  orderItemId: string,
  returnedQuantity: number,
): Promise<void> => {
  const reservations =
    await orderReservationRepository.findByOrderItem(orderItemId);
  let remaining = returnedQuantity;

  for (const reservation of reservations) {
    if (remaining <= 0) break;
    const give = Math.min(reservation.quantity, remaining);
    if (give <= 0) continue;

    const invRow = await inventoryRepository.findByProductAndWarehouse(
      reservation.orderItem.productId,
      reservation.warehouseId,
      reservation.orderItem.combinationId ?? undefined,
    );

    if (invRow) {
      await inventoryRepository.incrementQuantity(invRow.id, give);
    } else {
      await inventoryRepository.create({
        product_id: reservation.orderItem.productId,
        warehouse_id: reservation.warehouseId,
        combination_id: reservation.orderItem.combinationId ?? undefined,
        quantity: give,
      });
    }

    remaining -= give;
  }
};

export const registerReturnEventListeners = (): void => {
  eventBus.on("return.status.changed", async (payload) => {
    if (payload.toStatus !== ReturnStatus.COMPLETED) return;

    // ── R2 — remboursement des paiements complétés de la commande ──────────
    try {
      const payments = await paymentRepository.findByOrderId(payload.orderId);
      const completed = payments.filter(
        (p) => p.status === PaymentStatus.COMPLETED,
      );

      for (const payment of completed) {
        await paymentService.updateStatus(
          payment.id,
          {
            status: PaymentStatus.REFUNDED,
            notes: `Auto-refunded: return ${payload.returnRequestId} completed`,
          },
          null,
          "SYSTEM",
        );
      }
    } catch (err) {
      systemLogger.error("ORDER_SYNC_FAILED", {
        service: "return-listeners",
        metadata: {
          orderId: payload.orderId,
          returnRequestId: payload.returnRequestId,
          reason: "Failed to auto-refund payment on return completion",
          error: (err as Error).message,
        },
      });
    }

    // ── R3 — réintégration du stock ─────────────────────────────────────────
    try {
      for (const item of payload.items) {
        await reintegrateStockForOrderItem(item.orderItemId, item.quantity);
      }
    } catch (err) {
      systemLogger.error("ORDER_SYNC_FAILED", {
        service: "return-listeners",
        metadata: {
          orderId: payload.orderId,
          returnRequestId: payload.returnRequestId,
          reason: "Failed to reintegrate stock on return completion",
          error: (err as Error).message,
        },
      });
    }

    // ── R4 — reversal des points de fidélité gagnés sur cette commande ─────
    try {
      await loyaltyService.reverseForOrder(payload.userId, payload.orderId);
    } catch (err) {
      systemLogger.error("ORDER_SYNC_FAILED", {
        service: "return-listeners",
        metadata: {
          orderId: payload.orderId,
          returnRequestId: payload.returnRequestId,
          reason: "Failed to reverse loyalty points on return completion",
          error: (err as Error).message,
        },
      });
    }
  });
};
