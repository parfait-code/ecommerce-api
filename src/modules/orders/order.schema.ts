import { z } from "zod";
import { OrderStatus } from "@prisma/client";

const addressSchema = z.object({
  street: z.string(),
  city: z.string(),
  state: z.string().optional(),
  country: z.string(),
  postalCode: z.string(),
});

export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
  shippingAddressId: z.string().optional(),
  shippingAddress: addressSchema,
  billingAddressId: z.string().optional(),
  billingAddress: addressSchema.optional(),
  shippingMethodId: z.string().optional(),
  paymentMethodId: z.string().optional(),
  notes: z.string().optional(),
});

export const updateOrderSchema = z.object({
  shippingAddressId: z.string().optional(),
  shippingAddress: addressSchema.optional(),
  billingAddressId: z.string().optional(),
  billingAddress: addressSchema.optional(),
  shippingMethodId: z.string().optional(),
  notes: z.string().optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  reason: z.string().optional(),
  shippingCarrier: z.string().optional(),
  trackingNumber: z.string().optional(),
  estimatedDeliveryDate: z.string().optional(),
});

export type CreateOrderDto = z.infer<typeof createOrderSchema>;
export type UpdateOrderDto = z.infer<typeof updateOrderSchema>;
export type UpdateOrderStatusDto = z.infer<typeof updateOrderStatusSchema>;
