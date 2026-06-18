import { paymentRepository } from "./payment.repository";
import { orderRepository } from "../orders/order.repository";
import { CreatePaymentDto } from "./payment.schema";
import { AppError } from "../../shared/utils/app-error";
import { PaymentMethod } from "@prisma/client";
import { businessLogger, auditLogger } from "../../shared/logger";

const UNAVAILABLE_METHODS: PaymentMethod[] = ["PAYPAL", "STRIPE", "CINETPAY"];

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

    await orderRepository.updateStatus(dto.order_id, "CONFIRMED");

    businessLogger.log("PAYMENT_SUCCESS", {
      service: "payment",
      actor: { userId, role: "CUSTOMER" },
      target: { orderId: dto.order_id },
      metadata: {
        paymentId: payment.id,
        amount: order.totalAmount,
        currency: dto.currency,
        method: dto.method,
      },
    });

    auditLogger.log("PAYMENT_APPROVED", {
      service: "payment",
      actor: { userId, role: "CUSTOMER" },
      target: { orderId: dto.order_id },
      metadata: {
        paymentId: payment.id,
        amount: order.totalAmount,
        currency: dto.currency,
      },
    });

    return payment;
  },

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
