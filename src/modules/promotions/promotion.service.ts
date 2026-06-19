import { promotionRepository } from './promotion.repository'
import { categoryRepository }  from '../categories/category.repository'
import { productRepository }   from '../products/product.repository'
import {
  CreatePromotionDto, UpdatePromotionDto,
  CreateDiscountDto, CreateCouponDto, ValidateCouponDto,
} from './promotion.schema'
import { AppError }        from '../../shared/utils/app-error'
import { businessLogger }  from '../../shared/logger'

export const promotionService = {

  // ── Promotions ─────────────────────────────────────────────────────────────

  getAll: (query: { status?: string; isActive?: string }) =>
    promotionRepository.findAll(query),

  getById: async (id: string) => {
    const promotion = await promotionRepository.findById(id)
    if (!promotion) throw new AppError('Promotion not found', 404)
    return promotion
  },

  getBySlug: async (slug: string) => {
    const promotion = await promotionRepository.findBySlug(slug)
    if (!promotion) throw new AppError('Promotion not found', 404)
    return promotion
  },

  create: async (dto: CreatePromotionDto) => {
    const existing = await promotionRepository.existsBySlug(dto.slug)
    if (existing) throw new AppError('Promotion slug already taken', 409)

    const promotion = await promotionRepository.create(dto)

    businessLogger.log('PRODUCT_CREATED', {
      service:  'promotions',
      actor:    { userId: null, role: 'ADMIN' },
      target:   { productId: promotion.id },
      metadata: { name: promotion.name, slug: promotion.slug },
    })

    return promotion
  },

  update: async (id: string, dto: UpdatePromotionDto) => {
    const promotion = await promotionRepository.findById(id)
    if (!promotion) throw new AppError('Promotion not found', 404)

    if (dto.slug && dto.slug !== promotion.slug) {
      const existing = await promotionRepository.existsBySlug(dto.slug)
      if (existing) throw new AppError('Promotion slug already taken', 409)
    }

    if (dto.startDate && dto.endDate) {
      if (new Date(dto.endDate) <= new Date(dto.startDate))
        throw new AppError('endDate must be after startDate', 400)
    }

    return promotionRepository.update(id, dto)
  },

  toggle: async (id: string) => {
    const promotion = await promotionRepository.findById(id)
    if (!promotion) throw new AppError('Promotion not found', 404)

    const updated = await promotionRepository.toggle(id, !promotion.isActive)

    businessLogger.log('PRODUCT_UPDATED', {
      service:  'promotions',
      actor:    { userId: null, role: 'ADMIN' },
      target:   { productId: id },
      metadata: { isActive: updated.isActive },
    })

    return updated
  },

  delete: async (id: string) => {
    const promotion = await promotionRepository.findById(id)
    if (!promotion) throw new AppError('Promotion not found', 404)
    await promotionRepository.delete(id)
    return { message: 'Promotion deleted successfully' }
  },

  uploadImages: async (id: string, files: Express.Multer.File[]) => {
    const promotion = await promotionRepository.findById(id)
    if (!promotion) throw new AppError('Promotion not found', 404)

    const { uploadImage } = await import('../../shared/utils/upload')
    const uploadedUrls    = await Promise.all(files.map((f) => uploadImage(f, 'promotions')))

    return promotionRepository.addImages(id, uploadedUrls)
  },

  deleteImage: async (id: string, imageUrl: string) => {
    const promotion = await promotionRepository.findById(id)
    if (!promotion) throw new AppError('Promotion not found', 404)

    const images = promotion.images.filter((img) => img !== imageUrl)
    if (images.length === promotion.images.length)
      throw new AppError('Image not found', 404)

    const { deleteImage } = await import('../../shared/utils/upload')
    await deleteImage(imageUrl)

    return promotionRepository.removeImage(id, images)
  },

  // ── Discounts ──────────────────────────────────────────────────────────────

  createDiscount: async (promotionId: string, dto: CreateDiscountDto) => {
    const promotion = await promotionRepository.findById(promotionId)
    if (!promotion) throw new AppError('Promotion not found', 404)

    if (dto.type === 'PERCENTAGE' && dto.value > 100)
      throw new AppError('Percentage discount cannot exceed 100%', 400)

    if (dto.categoryId) {
      const category = await categoryRepository.findById(dto.categoryId)
      if (!category) throw new AppError('Category not found', 404)
    }

    if (dto.productIds && dto.productIds.length > 0) {
      for (const productId of dto.productIds) {
        const product = await productRepository.findById(productId)
        if (!product) throw new AppError(`Product ${productId} not found`, 404)
      }
    }

    return promotionRepository.createDiscount(promotionId, dto)
  },

  deleteDiscount: async (promotionId: string, discountId: string) => {
    const promotion = await promotionRepository.findById(promotionId)
    if (!promotion) throw new AppError('Promotion not found', 404)

    const discount = await promotionRepository.findDiscountById(discountId)
    if (!discount) throw new AppError('Discount not found', 404)

    if (discount.promotionId !== promotionId)
      throw new AppError('Discount does not belong to this promotion', 400)

    await promotionRepository.deleteDiscount(discountId)
    return { message: 'Discount deleted successfully' }
  },

  // ── Coupons ────────────────────────────────────────────────────────────────

  createCoupon: async (promotionId: string, dto: CreateCouponDto) => {
    const promotion = await promotionRepository.findById(promotionId)
    if (!promotion) throw new AppError('Promotion not found', 404)

    if (dto.startDate && dto.endDate) {
      if (new Date(dto.endDate) <= new Date(dto.startDate))
        throw new AppError('Coupon endDate must be after startDate', 400)
    }

    return promotionRepository.createCoupon(promotionId, dto)
  },

  deleteCoupon: async (promotionId: string, couponId: string) => {
    const promotion = await promotionRepository.findById(promotionId)
    if (!promotion) throw new AppError('Promotion not found', 404)

    const coupon = await promotionRepository.findCouponById(couponId)
    if (!coupon) throw new AppError('Coupon not found', 404)

    if (coupon.promotionId !== promotionId)
      throw new AppError('Coupon does not belong to this promotion', 400)

    await promotionRepository.deleteCoupon(couponId)
    return { message: 'Coupon deleted successfully' }
  },

  validateCoupon: async (dto: ValidateCouponDto, userId: number) => {
    const coupon = await promotionRepository.findCouponByCode(dto.code)

    if (!coupon)
      throw new AppError('Invalid coupon code', 404)

    if (!coupon.isActive)
      throw new AppError('This coupon is not active', 400)

    if (!coupon.promotion.isActive)
      throw new AppError('The promotion linked to this coupon is not active', 400)

    const now = new Date()

    if (coupon.startDate && now < coupon.startDate)
      throw new AppError('This coupon is not yet valid', 400)

    if (coupon.endDate && now > coupon.endDate)
      throw new AppError('This coupon has expired', 400)

    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses)
      throw new AppError('This coupon has reached its maximum usage limit', 400)

    const userUseCount = coupon.uses.filter((u) => u.userId === userId).length
    if (userUseCount >= coupon.perUserLimit)
      throw new AppError('You have already used this coupon the maximum number of times', 400)

    return {
      valid:       true,
      couponId:    coupon.id,
      code:        coupon.code,
      promotion: {
        id:        coupon.promotion.id,
        name:      coupon.promotion.name,
        slug:      coupon.promotion.slug,
      },
      discounts:   coupon.promotion.discounts,
    }
  },
}