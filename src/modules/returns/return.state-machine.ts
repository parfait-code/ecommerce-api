import { ReturnStatus } from "@prisma/client";
import { AppError } from "../../shared/utils/app-error";

const TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  PENDING: ["APPROVED", "REJECTED"],
  APPROVED: ["COMPLETED", "CANCELLED"],
  REJECTED: [],
  CANCELLED: [],
  COMPLETED: [],
};

export const assertValidReturnTransition = (
  from: ReturnStatus,
  to: ReturnStatus,
): void => {
  if (from === to) return;
  if (!TRANSITIONS[from].includes(to)) {
    throw new AppError(
      `Invalid return status transition: ${from} -> ${to}`,
      400,
    );
  }
};
