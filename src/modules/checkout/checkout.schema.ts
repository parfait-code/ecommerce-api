import { z } from 'zod'

const addressSchema = z.object({
  street:     z.string(),
  city:       z.string(),
  state:      z.string().optional(),
  country:    z.string(),
  postalCode: z.string(),
})

export const createCheckoutSchema = z.object({
  basket_id:          z.string(),
  shipping_address:   addressSchema,
  billing_address:    addressSchema.optional(),
  payment_method_id:  z.string().optional(),
  coupon_code:        z.string().optional(),
})

export type CreateCheckoutDto = z.infer<typeof createCheckoutSchema>