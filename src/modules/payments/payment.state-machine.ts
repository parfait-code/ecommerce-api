import { PaymentStatus } from "@prisma/client";
import { AppError } from "../../shared/utils/app-error";

const TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  PENDING: ["COMPLETED", "FAILED", "CANCELLED"],
  COMPLETED: ["REFUNDED"],
  FAILED: [],
  REFUNDED: [],
  CANCELLED: [],
};

export const assertValidPaymentTransition = (
  from: PaymentStatus,
  to: PaymentStatus,
): void => {
  if (from === to) return;
  if (!TRANSITIONS[from].includes(to)) {
    throw new AppError(`Invalid payment status transition: ${from} -> ${to}`, 400);
  }
};