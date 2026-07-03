import { z } from "zod";
import { ShipmentStatus } from "@prisma/client";

export const createShipmentSchema = z.object({
  sender_name: z.string(),
  sender_address: z.string(),
  recipient_name: z.string(),
  recipient_address: z.string(),
  weight: z.number().positive(),
  dimensions: z
    .object({
      length: z.number().positive(),
      width: z.number().positive(),
      height: z.number().positive(),
    })
    .optional(),
  order_id: z.string().optional(),
  estimated_delivery_at: z.string().datetime().optional(),
});

// "status" ici est un texte libre affiché dans l'historique (ex: "Colis arrivé au tri Yaoundé"),
// il ne correspond PAS au ShipmentStatus enum. "shipment_status" est optionnel et sert à
// mettre à jour le vrai statut officiel de l'expédition en même temps que l'événement.
export const trackingEventSchema = z.object({
  status: z.string(),
  location: z.string().optional(),
  shipment_status: z.nativeEnum(ShipmentStatus).optional(),
});

// Action dédiée pour changer uniquement le statut officiel, sans passer par un événement de suivi
export const updateShipmentStatusSchema = z.object({
  status: z.nativeEnum(ShipmentStatus),
  reason: z.string().optional(),
});

export const shippingCostSchema = z.object({
  origin: z.string(),
  destination: z.string(),
  weight: z.number().positive(),
  dimensions: z
    .object({
      length: z.number().positive(),
      width: z.number().positive(),
      height: z.number().positive(),
    })
    .optional(),
});

export const createPickupRequestSchema = z.object({
  pickup_date: z.string().datetime(),
  pickup_address: z.string(),
  order_id: z.string().optional(),
  shipment_id: z.string().optional(),
});

export type CreateShipmentDto = z.infer<typeof createShipmentSchema>;
export type TrackingEventDto = z.infer<typeof trackingEventSchema>;
export type UpdateShipmentStatusDto = z.infer<typeof updateShipmentStatusSchema>;
export type ShippingCostDto = z.infer<typeof shippingCostSchema>;
export type CreatePickupRequestDto = z.infer<typeof createPickupRequestSchema>;