import { z } from 'zod'

const addressSchema = z.object({
  street: z.string(),
  city: z.string(),
  state: z.string().optional(),
  country: z.string(),
  postalCode: z.string(),
})

export const createOrderSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    quantity: z.number().int().positive(),
  })).min(1),
  shippingAddress: addressSchema,
  billingAddress: addressSchema.optional(),
  paymentMethodId: z.string().optional(),
  notes: z.string().optional(),
  couponCode: z.string().optional(),
})

export const updateOrderSchema = z.object({
  shippingAddress: addressSchema.optional(),
  billingAddress: addressSchema.optional(),
  notes: z.string().optional(),
})

export const updateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  shippingCarrier: z.string().optional(),
  trackingNumber: z.string().optional(),
  estimatedDeliveryDate: z.string().optional(),
})

export const listOrdersSchema = z.object({
  status: z.string().optional(),
  customer: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
})

export type CreateOrderDto = z.infer<typeof createOrderSchema>
export type UpdateOrderDto = z.infer<typeof updateOrderSchema>
export type UpdateOrderStatusDto = z.infer<typeof updateOrderStatusSchema>