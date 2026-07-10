import { PickupStatus } from "@prisma/client";
import { AppError } from "../../shared/utils/app-error";

const TRANSITIONS: Record<PickupStatus, PickupStatus[]> = {
  PENDING: ["CONFIRMED", "COMPLETED", "CANCELLED", "EXPIRED"],
  CONFIRMED: ["COMPLETED", "CANCELLED", "EXPIRED"],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
};

/**
 * Volontairement permissive (PENDING → COMPLETED directement autorisé) —
 * ce module est piloté exclusivement par l'admin ("contrôle total" demandé
 * dans la spec), pas de client à protéger d'une transition invalide ici,
 * contrairement à order/payment/return.
 */
export const assertValidPickupTransition = (
  from: PickupStatus,
  to: PickupStatus,
): void => {
  if (from === to) return;
  if (!TRANSITIONS[from].includes(to)) {
    throw new AppError(
      `Invalid pickup request status transition: ${from} -> ${to}`,
      400,
    );
  }
};
