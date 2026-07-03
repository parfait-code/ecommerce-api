import { z } from 'zod'
import { PaymentStatus } from '@prisma/client'

export const createPaymentSchema = z.object({
  order_id: z.string(),
  method: z.enum(['CASH_ON_DELIVERY', 'PAYPAL', 'STRIPE', 'CINETPAY']),
  currency: z.string().default('XAF'),
  notes: z.string().optional(),
})

export const updatePaymentStatusSchema = z.object({
  status: z.nativeEnum(PaymentStatus),
  notes: z.string().optional(),
})

export type CreatePaymentDto = z.infer<typeof createPaymentSchema>
export type UpdatePaymentStatusDto = z.infer<typeof updatePaymentStatusSchema>