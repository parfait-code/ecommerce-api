import { z } from 'zod'

export const createShipmentSchema = z.object({
  sender_name: z.string(),
  sender_address: z.string(),
  recipient_name: z.string(),
  recipient_address: z.string(),
  weight: z.number().positive(),
  dimensions: z.object({
    length: z.number().positive(),
    width: z.number().positive(),
    height: z.number().positive(),
  }).optional(),
  order_id: z.string().optional(),
})

export const trackingEventSchema = z.object({
  status: z.string(),
  location: z.string().optional(),
})

export const shippingCostSchema = z.object({
  origin: z.string(),
  destination: z.string(),
  weight: z.number().positive(),
  dimensions: z.object({
    length: z.number().positive(),
    width: z.number().positive(),
    height: z.number().positive(),
  }).optional(),
})

export const createPickupRequestSchema = z.object({
  pickup_date: z.string(),
  pickup_address: z.string(),
})

export type CreateShipmentDto = z.infer<typeof createShipmentSchema>
export type TrackingEventDto = z.infer<typeof trackingEventSchema>
export type ShippingCostDto = z.infer<typeof shippingCostSchema>
export type CreatePickupRequestDto = z.infer<typeof createPickupRequestSchema>