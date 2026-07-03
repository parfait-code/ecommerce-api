import { OrderStatus } from "@prisma/client";
import { AppError } from "../../shared/utils/app-error";

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

export const assertValidTransition = (
  from: OrderStatus,
  to: OrderStatus,
): void => {
  if (from === to) return;
  if (!TRANSITIONS[from].includes(to)) {
    throw new AppError(
      `Invalid order status transition: ${from} -> ${to}`,
      400,
    );
  }
};
