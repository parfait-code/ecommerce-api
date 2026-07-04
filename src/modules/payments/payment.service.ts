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

    // Confirme la prise en charge de la commande — ne signifie PAS que
    // l'argent a été encaissé pour un COD (voir paymentService.updateStatus).
    await orderService.updateStatus(
      dto.order_id,
      { status: "CONFIRMED", reason: "Payment recorded — order confirmed" },
      userId,
      "SYSTEM",
    );

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

    // Un passage à COMPLETED confirme définitivement l'encaissement — si la
    // commande était restée PENDING (cas rare), on l'aligne sur CONFIRMED.
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

  getById: async (id: string) => {
    const payment = await paymentRepository.findById(id);
    if (!payment) throw new AppError("Payment not found", 404);
    return payment;
  },

  getByOrderId: async (orderId: string) => {
    return paymentRepository.findByOrderId(orderId);
  },
};
