import { OrderStatus, PaymentStatus } from "@prisma/client";
import { eventBus } from "../event-bus";
import { paymentRepository } from "../../../modules/payments/payment.repository";
import { paymentService } from "../../../modules/payments/payment.service";
import { systemLogger } from "../../logger";

/**
 * R1 — Order.status → DELIVERED et un paiement COD est encore PENDING
 * ⇒ Payment.status → COMPLETED.
 *
 * R6 (nouveau) — Order.status → CANCELLED (manuelle ou via le job
 * d'expiration) et un paiement est encore PENDING ⇒ Payment.status →
 * CANCELLED. Avant cette règle, annuler une commande laissait le paiement
 * associé bloqué à PENDING indéfiniment.
 */
export const registerPaymentEventListeners = (): void => {
  eventBus.on("order.status.changed", async (payload) => {
    if (payload.toStatus === OrderStatus.DELIVERED) {
      try {
        const payments = await paymentRepository.findByOrderId(payload.orderId);
        const pendingCod = payments.filter(
          (p) =>
            p.method === "CASH_ON_DELIVERY" &&
            p.status === PaymentStatus.PENDING,
        );

        for (const payment of pendingCod) {
          await paymentService.updateStatus(
            payment.id,
            {
              status: PaymentStatus.COMPLETED,
              notes: "Auto-completed: order delivered (COD)",
            },
            null,
            "SYSTEM",
          );
        }
      } catch (err) {
        systemLogger.error("ORDER_SYNC_FAILED", {
          service: "payment-listeners",
          metadata: {
            orderId: payload.orderId,
            reason: "Failed to auto-complete COD payment on delivery",
            error: (err as Error).message,
          },
        });
      }
      return;
    }

    if (payload.toStatus === OrderStatus.CANCELLED) {
      try {
        const payments = await paymentRepository.findByOrderId(payload.orderId);
        const pending = payments.filter(
          (p) => p.status === PaymentStatus.PENDING,
        );

        for (const payment of pending) {
          await paymentService.updateStatus(
            payment.id,
            {
              status: PaymentStatus.CANCELLED,
              notes: "Auto-cancelled: order cancelled",
            },
            null,
            "SYSTEM",
          );
        }
      } catch (err) {
        systemLogger.error("ORDER_SYNC_FAILED", {
          service: "payment-listeners",
          metadata: {
            orderId: payload.orderId,
            reason:
              "Failed to auto-cancel pending payment on order cancellation",
            error: (err as Error).message,
          },
        });
      }
    }
  });
};
