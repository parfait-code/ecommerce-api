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
import { settingService } from "../settings/setting.service";
import { SETTING_KEYS } from "../settings/setting.constants";

const ALL_METHODS: { id: PaymentMethod; name: string; description: string }[] =
  [
    {
      id: "CASH_ON_DELIVERY",
      name: "Cash on Delivery",
      description: "Pay in cash upon delivery of your order.",
    },
    { id: "PAYPAL", name: "PayPal", description: "Pay with PayPal." },
    {
      id: "STRIPE",
      name: "Stripe",
      description: "Pay with credit or debit card via Stripe.",
    },
    {
      id: "CINETPAY",
      name: "CinetPay",
      description: "Pay with CinetPay (Mobile Money, Orange Money, etc.).",
    },
  ];

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
  // Méthodes actives pilotées par le module Settings (payments.enabled_methods)
  // — activer Stripe/PayPal/CinetPay ne nécessite plus de redéploiement.
  getAvailableMethods: async () => {
    const [enabled, messages] = await Promise.all([
      settingService.getJSON<string[]>(SETTING_KEYS.PAYMENTS_ENABLED_METHODS, [
        "CASH_ON_DELIVERY",
      ]),
      settingService.getJSON<Record<string, string>>(
        SETTING_KEYS.PAYMENTS_UNAVAILABLE_MESSAGES,
        {},
      ),
    ]);

    return ALL_METHODS.map((method) => {
      const available = enabled.includes(method.id);
      return {
        ...method,
        available,
        ...(!available && {
          message:
            messages[method.id] ?? "This payment method is not available yet.",
        }),
      };
    });
  },

  create: async (userId: string, dto: CreatePaymentDto) => {
    const methods = await paymentService.getAvailableMethods();
    const method = methods.find((m) => m.id === dto.method);

    if (!method?.available) {
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

    if (dto.method === "CASH_ON_DELIVERY" && order.status === "PENDING") {
      try {
        await orderService.updateStatus(
          dto.order_id,
          {
            status: "CONFIRMED",
            reason: "COD payment recorded — order confirmed",
          },
          userId,
          "SYSTEM",
        );
      } catch (err) {
        systemLogger.error("ORDER_SYNC_FAILED", {
          service: "payment-service",
          metadata: {
            orderId: dto.order_id,
            paymentId: payment.id,
            reason: "Failed to auto-confirm order after COD payment creation",
            error: (err as Error).message,
          },
        });
      }
    }

    return payment;
  },

  updateStatus: async (
    paymentId: string,
    dto: UpdatePaymentStatusDto,
    adminUserId: string | null,
    actorRole: ActorRole = "ADMIN",
  ) => {
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) throw new AppError("Payment not found", 404);

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

  complete: (paymentId: string, adminUserId: string) =>
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

  getById: async (id: string, userId: string, isAdmin: boolean) => {
    const payment = await paymentRepository.findById(id);
    if (!payment) throw new AppError("Payment not found", 404);
    if (!isAdmin && payment.userId !== userId)
      throw new AppError("Forbidden", 403);
    return payment;
  },

  getByOrderId: async (orderId: string, userId: string, isAdmin: boolean) => {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new AppError("Order not found", 404);
    if (!isAdmin && order.userId !== userId)
      throw new AppError("Forbidden", 403);

    return paymentRepository.findByOrderId(orderId);
  },

  // Nouveau — réconciliation : rattrape les commandes restées PENDING suite
  // à un échec de la synchro de confirmation automatique lors de la création
  // d'un paiement COD. Ne touche JAMAIS aux autres méthodes de paiement.
  reconcileCodOrderConfirmation: async (): Promise<number> => {
    const stragglers = await paymentRepository.findPendingCodWithPendingOrder();
    let fixedCount = 0;

    for (const payment of stragglers) {
      try {
        await orderService.updateStatus(
          payment.orderId,
          {
            status: "CONFIRMED",
            reason:
              "Reconciliation: COD payment was recorded but order confirmation had previously failed",
          },
          null,
          "SYSTEM",
        );
        fixedCount++;
      } catch (err) {
        systemLogger.error("ORDER_SYNC_FAILED", {
          service: "payment-service",
          metadata: {
            orderId: payment.orderId,
            paymentId: payment.id,
            reason: "Reconciliation attempt failed",
            error: (err as Error).message,
          },
        });
      }
    }

    return fixedCount;
  },
};
