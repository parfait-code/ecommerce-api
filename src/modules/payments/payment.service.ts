import { paymentRepository } from "./payment.repository";
import { orderRepository } from "../orders/order.repository";
import { orderService } from "../orders/order.service";
import { CreatePaymentDto, UpdatePaymentStatusDto } from "./payment.schema";
import { AppError } from "../../shared/utils/app-error";
import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { assertValidPaymentTransition } from "./payment.state-machine";
import {
  businessLogger,
  auditLogger,
  BusinessEvent,
  AuditEvent,
  ActorRole,
  systemLogger,
} from "../../shared/logger";

const UNAVAILABLE_METHODS: PaymentMethod[] = ["PAYPAL", "STRIPE", "CINETPAY"];

// ── Mapping statut → événement de log (aucune entrée = pas de log pour ce statut) ──
const BUSINESS_EVENT_MAP: Partial<Record<PaymentStatus, BusinessEvent>> = {
  COMPLETED: "PAYMENT_SUCCESS",
  FAILED: "PAYMENT_FAILED",
  REFUNDED: "PAYMENT_REFUNDED",
};

const AUDIT_EVENT_MAP: Partial<Record<PaymentStatus, AuditEvent>> = {
  COMPLETED: "PAYMENT_APPROVED",
  REFUNDED: "PAYMENT_REFUNDED",
  CANCELLED: "PAYMENT_CANCELLED",
};

export const paymentService = {
  getAvailableMethods: () => [
    {
      id: "CASH_ON_DELIVERY",
      name: "Cash on Delivery",
      description: "Pay in cash upon delivery of your order.",
      available: true,
    },
    {
      id: "PAYPAL",
      name: "PayPal",
      description: "Pay with PayPal.",
      available: false,
      message: "PayPal payment is not available yet. Coming soon.",
    },
    {
      id: "STRIPE",
      name: "Stripe",
      description: "Pay with credit or debit card via Stripe.",
      available: false,
      message: "Stripe payment is not available yet. Coming soon.",
    },
    {
      id: "CINETPAY",
      name: "CinetPay",
      description: "Pay with CinetPay (Mobile Money, Orange Money, etc.).",
      available: false,
      message: "CinetPay payment is not available yet. Coming soon.",
    },
  ],

  create: async (userId: number, dto: CreatePaymentDto) => {
    if (UNAVAILABLE_METHODS.includes(dto.method as PaymentMethod)) {
      const method = paymentService
        .getAvailableMethods()
        .find((m) => m.id === dto.method);

      businessLogger.log("PAYMENT_FAILED", {
        service: "payment",
        actor: { userId, role: "CUSTOMER" },
        target: { orderId: dto.order_id },
        metadata: {
          method: dto.method,
          reason: "Payment method not available",
        },
      });

      throw new AppError(
        method?.message ?? "This payment method is not available yet.",
        503,
      );
    }

    const order = await orderRepository.findById(dto.order_id);
    if (!order) throw new AppError("Order not found", 404);
    if (order.userId !== userId) throw new AppError("Forbidden", 403);

    businessLogger.log("PAYMENT_INITIATED", {
      service: "payment",
      actor: { userId, role: "CUSTOMER" },
      target: { orderId: dto.order_id },
      metadata: {
        method: dto.method,
        amount: order.totalAmount,
        currency: dto.currency,
      },
    });

    const payment = await paymentRepository.create({
      orderId: dto.order_id,
      userId,
      method: dto.method as PaymentMethod,
      amount: order.totalAmount,
      currency: dto.currency,
      notes: dto.notes,
    });

    // resolve.md #5.3 — PENDING → CONFIRMED n'est plus systématique : seule
    // une méthode COD (prise en charge sans encaissement réel, par nature)
    // confirme automatiquement à la création. Un paiement PENDING sur une
    // méthode "réellement encaissée" confirmera la commande via updateStatus
    // → COMPLETED (voir plus haut), pas à la simple création du paiement.
    if (dto.method === "CASH_ON_DELIVERY" && order.status === "PENDING") {
      await orderService.updateStatus(
        dto.order_id,
        {
          status: "CONFIRMED",
          reason: "COD payment recorded — order confirmed",
        },
        userId,
        "SYSTEM",
      );
    }

    return payment;
  },
  /**
   * Change le statut d'un paiement existant (ex: confirmer un encaissement COD
   * réel à la livraison, marquer un échec, ou rembourser).
   * Réservé à l'admin. Transitions validées via payment.state-machine.
   */
  updateStatus: async (
    paymentId: string,
    dto: UpdatePaymentStatusDto,
    adminUserId: number | null,
    actorRole: ActorRole = "ADMIN",
  ) => {
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) throw new AppError("Payment not found", 404);

    // resolve.md #5.2 — les transitions manuelles admin ne peuvent viser que
    // REFUNDED ; PENDING → COMPLETED/FAILED/CANCELLED restent exclusivement
    // automatiques (event bus : complétion COD à la livraison, etc.).
    if (actorRole === "ADMIN" && dto.status !== "REFUNDED") {
      throw new AppError(
        "Manual payment status changes are restricted to REFUNDED — other transitions happen automatically as part of the order/return lifecycle.",
        400,
      );
    }

    assertValidPaymentTransition(payment.status, dto.status);

    const oldStatus = payment.status;
    const updated = await paymentRepository.updateStatus(
      paymentId,
      dto.status,
      dto.notes,
    );

    const businessEvent = BUSINESS_EVENT_MAP[dto.status];
    if (businessEvent) {
      businessLogger.log(businessEvent, {
        service: "payment",
        actor: { userId: adminUserId, role: actorRole },
        target: { orderId: payment.orderId, paymentId },
        metadata: {
          oldStatus,
          newStatus: dto.status,
          method: payment.method,
          amount: payment.amount,
          currency: payment.currency,
        },
      });
    }

    const auditEvent = AUDIT_EVENT_MAP[dto.status];
    if (auditEvent) {
      auditLogger.log(auditEvent, {
        service: "payment",
        actor: { userId: adminUserId, role: actorRole },
        target: { orderId: payment.orderId },
        metadata: {
          paymentId,
          oldStatus,
          newStatus: dto.status,
          notes: dto.notes,
        },
      });
    }

    if (dto.status === "COMPLETED") {
      const order = await orderRepository.findById(payment.orderId);
      if (order && order.status === "PENDING") {
        await orderService.updateStatus(
          payment.orderId,
          { status: "CONFIRMED", reason: "Payment completed" },
          adminUserId,
          actorRole,
        );
      }
    }

    // resolve.md #5.2 — cascade Payment → Order sur remboursement, cohérent
    // avec la transition DELIVERED → REFUNDED déjà utilisée pour les retours.
    // Best-effort : si la commande n'est pas dans un état compatible (rare,
    // ex. remboursement d'un paiement d'une commande jamais livrée), on ne
    // bloque pas le remboursement du paiement lui-même — on trace l'échec.
    if (dto.status === "REFUNDED") {
      const order = await orderRepository.findById(payment.orderId);
      if (order && order.status !== "REFUNDED") {
        try {
          await orderService.updateStatus(
            payment.orderId,
            { status: "REFUNDED", reason: `Payment ${paymentId} refunded` },
            adminUserId,
            actorRole,
          );
        } catch (err) {
          systemLogger.error("ORDER_SYNC_FAILED", {
            service: "payment-service",
            metadata: {
              orderId: payment.orderId,
              paymentId,
              reason: "Failed to sync order status after payment refund",
              error: (err as Error).message,
            },
          });
        }
      }
    }

    return updated;
  },

  // Conservé pour compatibilité ascendante — alias de updateStatus(COMPLETED)
  complete: (paymentId: string, adminUserId: number) =>
    paymentService.updateStatus(
      paymentId,
      { status: "COMPLETED" },
      adminUserId,
    ),

  getAll: async (query: {
    page?: string;
    limit?: string;
    status?: string;
    method?: string;
    order_id?: string;
  }) => {
    const [items, total] = await paymentRepository.findAll(query);
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  getById: async (id: string, userId: number, isAdmin: boolean) => {
    const payment = await paymentRepository.findById(id);
    if (!payment) throw new AppError("Payment not found", 404);
    if (!isAdmin && payment.userId !== userId)
      throw new AppError("Forbidden", 403);
    return payment;
  },

  getByOrderId: async (orderId: string, userId: number, isAdmin: boolean) => {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new AppError("Order not found", 404);
    if (!isAdmin && order.userId !== userId)
      throw new AppError("Forbidden", 403);

    return paymentRepository.findByOrderId(orderId);
  },
};
