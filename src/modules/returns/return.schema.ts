import { z } from "zod";
import { ReturnStatus } from "@prisma/client";

const collectionSchema = z
  .object({
    method: z
      .enum(["ORIGINAL_ADDRESS", "WAREHOUSE_DROPOFF", "CUSTOM_ADDRESS"])
      .default("ORIGINAL_ADDRESS"),
    address_id: z.string().optional(),
    warehouse_id: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.method === "WAREHOUSE_DROPOFF") return !!data.warehouse_id;
      if (data.method === "CUSTOM_ADDRESS") return !!data.address_id;
      return true;
    },
    { message: "Missing required field for the selected collection method" },
  );

export const createReturnSchema = z.object({
  order_id: z.string(),
  reason: z.string().min(2),
  notes: z.string().optional(),
  // Pas de `quantity` — un retour porte toujours la quantité complète de
  // l'orderItem visé (spec produit : pas de retour partiel d'un même
  // article). Pour retourner toute la commande, inclure tous les
  // order_item_id de la commande.
  items: z
    .array(
      z.object({
        order_item_id: z.string(),
        condition: z.string().optional(),
      }),
    )
    .min(1),
  collection: collectionSchema.default({ method: "ORIGINAL_ADDRESS" }),
});

export const updateReturnStatusSchema = z
  .object({
    status: z.nativeEnum(ReturnStatus),
    notes: z.string().optional(),
    // Requis uniquement pour la transition vers APPROVED — c'est à ce
    // moment que la pickup request est matérialisée.
    pickup_deadline: z.string().datetime().optional(),
  })
  .refine((data) => data.status !== "APPROVED" || !!data.pickup_deadline, {
    message: "pickup_deadline is required when approving a return request",
    path: ["pickup_deadline"],
  });

export type CreateReturnDto = z.infer<typeof createReturnSchema>;
export type UpdateReturnStatusDto = z.infer<typeof updateReturnStatusSchema>;
