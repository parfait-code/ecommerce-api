import { z } from "zod";
import { PickupStatus } from "@prisma/client";

// Pas de schéma de création exposé — une pickup request naît exclusivement
// de l'approbation d'un retour (return.service.ts::updateStatus).

export const updatePickupLocationSchema = z
  .object({
    method: z.enum(["ORIGINAL_ADDRESS", "WAREHOUSE_DROPOFF", "CUSTOM_ADDRESS"]),
    address_id: z.string().optional(),
    warehouse_id: z.string().optional(),
    pickup_date: z.string().datetime().optional(),
    deadline: z.string().datetime().optional(),
  })
  .refine(
    (data) => {
      if (data.method === "WAREHOUSE_DROPOFF") return !!data.warehouse_id;
      if (data.method === "CUSTOM_ADDRESS") return !!data.address_id;
      return true;
    },
    { message: "Missing required field for the selected collection method" },
  );

export const updatePickupStatusSchema = z.object({
  status: z.nativeEnum(PickupStatus),
  notes: z.string().optional(),
});

export type UpdatePickupLocationDto = z.infer<
  typeof updatePickupLocationSchema
>;
export type UpdatePickupStatusDto = z.infer<typeof updatePickupStatusSchema>;
