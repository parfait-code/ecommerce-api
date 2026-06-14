import { z } from 'zod'

export const createPaymentSchema = z.object({
  order_id: z.string(),
  method: z.enum(['CASH_ON_DELIVERY', 'PAYPAL', 'STRIPE', 'CINETPAY']),
  currency: z.string().default('XAF'),
  notes: z.string().optional(),
})

export type CreatePaymentDto = z.infer<typeof createPaymentSchema>