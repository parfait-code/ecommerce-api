import { z } from "zod";

export const createPromotionSchema = z
  .object({
    name: z.string().min(2).max(200),
    slug: z
      .string()
      .min(2)
      .max(200)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        message: "Slug must be lowercase, alphanumeric and hyphen-separated",
      }),
    description: z.string().optional(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    isActive: z.boolean().default(true),
    isFeaturedInHero: z.boolean().default(false),
    heroPosition: z.number().int().min(0).optional(),
    heroImages: z.array(z.string().url()).default([]),
  })
  .refine((data) => new Date(data.endDate) > new Date(data.startDate), {
    message: "endDate must be after startDate",
    path: ["endDate"],
  });

export const updatePromotionSchema = z
  .object({
    name: z.string().min(2).max(200).optional(),
    slug: z
      .string()
      .min(2)
      .max(200)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    description: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    isActive: z.boolean().optional(),
    isFeaturedInHero: z.boolean().optional(),
    heroPosition: z.number().int().min(0).optional(),
    heroImages: z.array(z.string().url()).optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.endDate) > new Date(data.startDate);
      }
      return true;
    },
    {
      message: "endDate must be after startDate",
      path: ["endDate"],
    },
  );

const discountBaseSchema = z.object({
  type: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  value: z.number().positive(),
  categoryId: z.string().optional(),
  productIds: z.array(z.string()).optional(),
});

export const createDiscountSchema = discountBaseSchema.refine(
  (data) => data.categoryId || (data.productIds && data.productIds.length > 0),
  {
    message: "A discount must target at least one category or one product",
    path: ["categoryId"],
  },
);

export const updateDiscountSchema = z
  .object({
    type: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]).optional(),
    value: z.number().positive().optional(),
    categoryId: z.string().optional(),
    productIds: z.array(z.string()).optional(),
  })
  .refine(
    (data) => {
      if (data.categoryId === undefined && data.productIds === undefined) {
        return true;
      }
      return data.categoryId || (data.productIds && data.productIds.length > 0);
    },
    {
      message: "A discount must target at least one category or one product",
      path: ["categoryId"],
    },
  );

export const createCouponSchema = z
  .object({
    code: z.string().min(3).max(50).toUpperCase(),
    maxUses: z.number().int().positive().optional(),
    perUserLimit: z.number().int().positive().default(1),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.endDate) > new Date(data.startDate);
      }
      return true;
    },
    {
      message: "endDate must be after startDate",
      path: ["endDate"],
    },
  );

export const updateCouponSchema = z
  .object({
    code: z.string().min(3).max(50).toUpperCase().optional(),
    maxUses: z.number().int().positive().optional(),
    perUserLimit: z.number().int().positive().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.endDate) > new Date(data.startDate);
      }
      return true;
    },
    {
      message: "endDate must be after startDate",
      path: ["endDate"],
    },
  );

export const validateCouponSchema = z.object({
  code: z.string().min(1, "Code is required"),
  basketId: z.string().optional(),
  items: z
    .array(
      z.object({
        id: z.string(),
        variantId: z.string().optional(),
        quantity: z.number().int().positive(),
      }),
    )
    .optional(),
});

export type CreatePromotionDto = z.infer<typeof createPromotionSchema>;
export type UpdatePromotionDto = z.infer<typeof updatePromotionSchema>;
export type CreateDiscountDto = z.infer<typeof createDiscountSchema>;
export type UpdateDiscountDto = z.infer<typeof updateDiscountSchema>;
export type CreateCouponDto = z.infer<typeof createCouponSchema>;
export type UpdateCouponDto = z.infer<typeof updateCouponSchema>;
export type ValidateCouponDto = z.infer<typeof validateCouponSchema>;
