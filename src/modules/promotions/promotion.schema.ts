import { z } from 'zod'

// ============================================
// SCHÉMAS POUR LES PROMOTIONS
// ============================================

export const createPromotionSchema = z.object({
  name:        z.string().min(2).max(200),
  slug:        z.string().min(2).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase, alphanumeric and hyphen-separated',
  }),
  description: z.string().optional(),
  startDate:   z.string().datetime(),
  endDate:     z.string().datetime(),
  isActive:    z.boolean().default(true),
}).refine((data) => new Date(data.endDate) > new Date(data.startDate), {
  message: 'endDate must be after startDate',
  path:    ['endDate'],
})

export const updatePromotionSchema = z.object({
  name:        z.string().min(2).max(200).optional(),
  slug:        z.string().min(2).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  description: z.string().optional(),
  startDate:   z.string().datetime().optional(),
  endDate:     z.string().datetime().optional(),
  isActive:    z.boolean().optional(),
}).refine((data) => {
  // Si les deux dates sont fournies, vérifier que endDate > startDate
  if (data.startDate && data.endDate) {
    return new Date(data.endDate) > new Date(data.startDate)
  }
  // Si une seule date est fournie ou aucune, pas de validation nécessaire
  return true
}, {
  message: 'endDate must be after startDate',
  path:    ['endDate'],
})

// ============================================
// SCHÉMAS POUR LES REMISES (DISCOUNTS)
// ============================================

// Schéma de base pour les remises (sans validation de ciblage)
const discountBaseSchema = z.object({
  type:       z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
  value:      z.number().positive(),
  categoryId: z.string().optional(),
  productIds: z.array(z.number().int().positive()).optional(),
})

// Schéma de création - avec validation stricte
export const createDiscountSchema = discountBaseSchema.refine(
  (data) => data.categoryId || (data.productIds && data.productIds.length > 0),
  {
    message: 'A discount must target at least one category or one product',
    path:    ['categoryId'],
  },
)

// Schéma de mise à jour - tous les champs sont optionnels
export const updateDiscountSchema = z.object({
  type:       z.enum(['PERCENTAGE', 'FIXED_AMOUNT']).optional(),
  value:      z.number().positive().optional(),
  categoryId: z.string().optional(),
  productIds: z.array(z.number().int().positive()).optional(),
}).refine(
  (data) => {
    // Cas 1: Aucune modification du ciblage → valide
    if (data.categoryId === undefined && data.productIds === undefined) {
      return true
    }
    
    // Cas 2: Modification du ciblage → au moins un champ doit être renseigné
    return data.categoryId || (data.productIds && data.productIds.length > 0)
  },
  {
    message: 'A discount must target at least one category or one product',
    path:    ['categoryId'],
  },
)

// ============================================
// SCHÉMAS POUR LES COUPONS
// ============================================

export const createCouponSchema = z.object({
  code:         z.string().min(3).max(50).toUpperCase(),
  maxUses:      z.number().int().positive().optional(),
  perUserLimit: z.number().int().positive().default(1),
  startDate:    z.string().datetime().optional(),
  endDate:      z.string().datetime().optional(),
  isActive:     z.boolean().default(true),
}).refine((data) => {
  // Si les deux dates sont fournies, vérifier que endDate > startDate
  if (data.startDate && data.endDate) {
    return new Date(data.endDate) > new Date(data.startDate)
  }
  return true
}, {
  message: 'endDate must be after startDate',
  path:    ['endDate'],
})

export const updateCouponSchema = z.object({
  code:         z.string().min(3).max(50).toUpperCase().optional(),
  maxUses:      z.number().int().positive().optional(),
  perUserLimit: z.number().int().positive().optional(),
  startDate:    z.string().datetime().optional(),
  endDate:      z.string().datetime().optional(),
  isActive:     z.boolean().optional(),
}).refine((data) => {
  // Si les deux dates sont fournies, vérifier que endDate > startDate
  if (data.startDate && data.endDate) {
    return new Date(data.endDate) > new Date(data.startDate)
  }
  return true
}, {
  message: 'endDate must be after startDate',
  path:    ['endDate'],
})

// ============================================
// SCHÉMA DE VALIDATION DE COUPON
// ============================================

export const validateCouponSchema = z.object({
  code:      z.string().min(1, 'Code is required'),
  basketId:  z.string().min(1, 'Basket ID is required'),
})

// ============================================
// TYPES INFÉRÉS
// ============================================

export type CreatePromotionDto  = z.infer<typeof createPromotionSchema>
export type UpdatePromotionDto  = z.infer<typeof updatePromotionSchema>
export type CreateDiscountDto   = z.infer<typeof createDiscountSchema>
export type UpdateDiscountDto   = z.infer<typeof updateDiscountSchema>
export type CreateCouponDto     = z.infer<typeof createCouponSchema>
export type UpdateCouponDto     = z.infer<typeof updateCouponSchema>
export type ValidateCouponDto   = z.infer<typeof validateCouponSchema>