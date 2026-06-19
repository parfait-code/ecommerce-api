// tests/unit/promotion.service.test.ts
import { promotionService } from '../../src/modules/promotions/promotion.service'
import { promotionRepository } from '../../src/modules/promotions/promotion.repository'
import { categoryRepository } from '../../src/modules/categories/category.repository'
import { productRepository } from '../../src/modules/products/product.repository'
import { AppError } from '../../src/shared/utils/app-error'

jest.mock('../../src/modules/promotions/promotion.repository')
jest.mock('../../src/modules/categories/category.repository')
jest.mock('../../src/modules/products/product.repository')

const mockPromotionRepository = promotionRepository as jest.Mocked<typeof promotionRepository>
const mockCategoryRepository = categoryRepository as jest.Mocked<typeof categoryRepository>
const mockProductRepository = productRepository as jest.Mocked<typeof productRepository>

const now = new Date()
const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

const mockPromotion = {
  id: 'promo-cuid-1',
  name: 'Summer Sale',
  slug: 'summer-sale',
  description: 'Great discounts this summer',
  images: [],
  status: 'ACTIVE' as const,
  isActive: true,
  startDate: now,
  endDate: future,
  createdAt: new Date(),
  updatedAt: new Date(),
  discounts: [],
  coupons: [],
  _count: { coupons: 0, discounts: 0 },
}

const mockDiscount = {
  id: 'discount-cuid-1',
  promotionId: 'promo-cuid-1',
  type: 'PERCENTAGE' as const,
  value: 10,
  categoryId: null,
  category: null,
  products: [] as {
    id: string
    discountId: string
    productId: number
    product: { id: number; name: string; price: number; images: string[] }
  }[],
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockCoupon = {
  id: 'coupon-cuid-1',
  code: 'SUMMER10',
  promotionId: 'promo-cuid-1',
  maxUses: 100,
  usedCount: 0,
  perUserLimit: 1,
  startDate: null,
  endDate: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockCategory = {
  id: 'cat-cuid-1',
  name: 'Electronics',
  slug: 'electronics',
  description: null,
  parentId: null,
  parent: null,
  children: [],
  _count: { products: 0 },
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockProduct = {
  id: 1,
  name: 'Test Product',
  description: null,
  price: 99.99,
  categoryId: 'cat-cuid-1',
  category: mockCategory,
  stock: 10,
  images: [],
  createdAt: new Date(),
  updatedAt: new Date(),
}

// Type du coupon tel que retourné par findCouponByCode (avec relations)
// On utilise un type structurel minimal compatible avec ce que le service lit
interface MockCouponWithRelations {
  id: string
  code: string
  promotionId: string
  maxUses: number | null
  usedCount: number
  perUserLimit: number
  startDate: Date | null
  endDate: Date | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  uses: { userId: number }[]
  promotion: {
    id: string
    name: string
    slug: string
    isActive: boolean
    discounts: {
      id: string
      type: string
      value: number
      categoryId: string | null
      category: { id: string } | null
      products: { productId: number }[]
      promotionId: string
      createdAt: Date
      updatedAt: Date
    }[]
  }
}

const makeCouponWithRelations = (overrides: Partial<MockCouponWithRelations> = {}): any => ({
  ...mockCoupon,
  uses: [] as { userId: number }[],
  promotion: {
    id: 'promo-cuid-1',
    name: 'Summer Sale',
    slug: 'summer-sale',
    isActive: true,
    discounts: [] as {
      id: string
      type: string
      value: number
      categoryId: string | null
      category: { id: string } | null
      products: { productId: number }[]
      promotionId: string
      createdAt: Date
      updatedAt: Date
    }[],
  },
  ...overrides,
})

describe('PromotionService', () => {
  describe('getAll', () => {
    it('should return all promotions', async () => {
      mockPromotionRepository.findAll.mockResolvedValue([mockPromotion])

      const result = await promotionService.getAll({})

      expect(result).toHaveLength(1)
      expect(result[0].slug).toBe('summer-sale')
    })

    it('should filter by status', async () => {
      mockPromotionRepository.findAll.mockResolvedValue([mockPromotion])

      await promotionService.getAll({ status: 'ACTIVE' })

      expect(mockPromotionRepository.findAll).toHaveBeenCalledWith({ status: 'ACTIVE' })
    })
  })

  describe('getById', () => {
    it('should return promotion if found', async () => {
      mockPromotionRepository.findById.mockResolvedValue(mockPromotion)

      const result = await promotionService.getById('promo-cuid-1')

      expect(result).toEqual(mockPromotion)
    })

    it('should throw 404 if not found', async () => {
      mockPromotionRepository.findById.mockResolvedValue(null)

      await expect(promotionService.getById('nonexistent')).rejects.toThrow(
        new AppError('Promotion not found', 404),
      )
    })
  })

  describe('getBySlug', () => {
    it('should return promotion by slug', async () => {
      mockPromotionRepository.findBySlug.mockResolvedValue(mockPromotion)

      const result = await promotionService.getBySlug('summer-sale')

      expect(result).toEqual(mockPromotion)
    })

    it('should throw 404 if not found', async () => {
      mockPromotionRepository.findBySlug.mockResolvedValue(null)

      await expect(promotionService.getBySlug('nonexistent')).rejects.toThrow(
        new AppError('Promotion not found', 404),
      )
    })
  })

  describe('create', () => {
    it('should create a promotion', async () => {
      mockPromotionRepository.existsBySlug.mockResolvedValue(null)
      mockPromotionRepository.create.mockResolvedValue(mockPromotion)

      const result = await promotionService.create({
        name: 'Summer Sale',
        slug: 'summer-sale',
        startDate: now.toISOString(),
        endDate: future.toISOString(),
        isActive: true,
      })

      expect(result).toEqual(mockPromotion)
    })

    it('should throw 409 if slug already taken', async () => {
      mockPromotionRepository.existsBySlug.mockResolvedValue(mockPromotion)

      await expect(
        promotionService.create({
          name: 'Duplicate',
          slug: 'summer-sale',
          startDate: now.toISOString(),
          endDate: future.toISOString(),
          isActive: true,
        }),
      ).rejects.toThrow(new AppError('Promotion slug already taken', 409))
    })
  })

  describe('toggle', () => {
    it('should toggle promotion isActive from true to false', async () => {
      const toggled = { ...mockPromotion, isActive: false }
      mockPromotionRepository.findById.mockResolvedValue(mockPromotion)
      mockPromotionRepository.toggle.mockResolvedValue(toggled)

      const result = await promotionService.toggle('promo-cuid-1')

      expect(mockPromotionRepository.toggle).toHaveBeenCalledWith('promo-cuid-1', false)
      expect(result.isActive).toBe(false)
    })

    it('should toggle promotion isActive from false to true', async () => {
      const inactive = { ...mockPromotion, isActive: false }
      const toggled = { ...mockPromotion, isActive: true }
      mockPromotionRepository.findById.mockResolvedValue(inactive)
      mockPromotionRepository.toggle.mockResolvedValue(toggled)

      const result = await promotionService.toggle('promo-cuid-1')

      expect(mockPromotionRepository.toggle).toHaveBeenCalledWith('promo-cuid-1', true)
      expect(result.isActive).toBe(true)
    })

    it('should throw 404 if promotion not found', async () => {
      mockPromotionRepository.findById.mockResolvedValue(null)

      await expect(promotionService.toggle('nonexistent')).rejects.toThrow(
        new AppError('Promotion not found', 404),
      )
    })
  })

  describe('delete', () => {
    it('should delete promotion and return message', async () => {
      mockPromotionRepository.findById.mockResolvedValue(mockPromotion)
      mockPromotionRepository.delete.mockResolvedValue(mockPromotion)

      const result = await promotionService.delete('promo-cuid-1')

      expect(result).toEqual({ message: 'Promotion deleted successfully' })
    })

    it('should throw 404 if not found', async () => {
      mockPromotionRepository.findById.mockResolvedValue(null)

      await expect(promotionService.delete('nonexistent')).rejects.toThrow(
        new AppError('Promotion not found', 404),
      )
    })
  })

  describe('createDiscount', () => {
    it('should create a discount targeting a category', async () => {
      mockPromotionRepository.findById.mockResolvedValue(mockPromotion)
      mockCategoryRepository.findById.mockResolvedValue(mockCategory)
      mockPromotionRepository.createDiscount.mockResolvedValue(mockDiscount)

      const result = await promotionService.createDiscount('promo-cuid-1', {
        type: 'PERCENTAGE',
        value: 10,
        categoryId: 'cat-cuid-1',
      })

      expect(result).toEqual(mockDiscount)
      expect(mockPromotionRepository.createDiscount).toHaveBeenCalledWith(
        'promo-cuid-1',
        expect.objectContaining({ type: 'PERCENTAGE', value: 10 }),
      )
    })

    it('should create a discount targeting products', async () => {
      const discountWithProduct = {
        ...mockDiscount,
        products: [
          {
            id: 'dp-1',
            discountId: 'discount-cuid-1',
            productId: 1,
            product: { id: 1, name: 'Test Product', price: 99.99, images: [] },
          },
        ],
      }
      mockPromotionRepository.findById.mockResolvedValue(mockPromotion)
      mockProductRepository.findById.mockResolvedValue(mockProduct)
      mockPromotionRepository.createDiscount.mockResolvedValue(discountWithProduct)

      const result = await promotionService.createDiscount('promo-cuid-1', {
        type: 'FIXED_AMOUNT',
        value: 500,
        productIds: [1],
      })

      expect(result).toBeDefined()
      expect(result!.products).toHaveLength(1)
    })

    it('should throw 404 if promotion not found', async () => {
      mockPromotionRepository.findById.mockResolvedValue(null)

      await expect(
        promotionService.createDiscount('nonexistent', {
          type: 'PERCENTAGE',
          value: 10,
          categoryId: 'cat-cuid-1',
        }),
      ).rejects.toThrow(new AppError('Promotion not found', 404))
    })

    it('should throw 400 if percentage discount exceeds 100', async () => {
      mockPromotionRepository.findById.mockResolvedValue(mockPromotion)

      await expect(
        promotionService.createDiscount('promo-cuid-1', {
          type: 'PERCENTAGE',
          value: 110,
          categoryId: 'cat-cuid-1',
        }),
      ).rejects.toThrow(new AppError('Percentage discount cannot exceed 100%', 400))
    })

    it('should throw 404 if category not found', async () => {
      mockPromotionRepository.findById.mockResolvedValue(mockPromotion)
      mockCategoryRepository.findById.mockResolvedValue(null)

      await expect(
        promotionService.createDiscount('promo-cuid-1', {
          type: 'PERCENTAGE',
          value: 10,
          categoryId: 'nonexistent',
        }),
      ).rejects.toThrow(new AppError('Category not found', 404))
    })
  })

  describe('deleteDiscount', () => {
    it('should delete discount and return message', async () => {
      mockPromotionRepository.findById.mockResolvedValue(mockPromotion)
      mockPromotionRepository.findDiscountById.mockResolvedValue({
        ...mockDiscount,
        promotionId: 'promo-cuid-1',
      })
      mockPromotionRepository.deleteDiscount.mockResolvedValue(mockDiscount)

      const result = await promotionService.deleteDiscount('promo-cuid-1', 'discount-cuid-1')

      expect(result).toEqual({ message: 'Discount deleted successfully' })
    })

    it('should throw 404 if discount not found', async () => {
      mockPromotionRepository.findById.mockResolvedValue(mockPromotion)
      mockPromotionRepository.findDiscountById.mockResolvedValue(null)

      await expect(
        promotionService.deleteDiscount('promo-cuid-1', 'nonexistent'),
      ).rejects.toThrow(new AppError('Discount not found', 404))
    })

    it('should throw 400 if discount does not belong to promotion', async () => {
      mockPromotionRepository.findById.mockResolvedValue(mockPromotion)
      mockPromotionRepository.findDiscountById.mockResolvedValue({
        ...mockDiscount,
        promotionId: 'other-promo-id',
      })

      await expect(
        promotionService.deleteDiscount('promo-cuid-1', 'discount-cuid-1'),
      ).rejects.toThrow(new AppError('Discount does not belong to this promotion', 400))
    })
  })

  describe('createCoupon', () => {
    it('should create a coupon', async () => {
      mockPromotionRepository.findById.mockResolvedValue(mockPromotion)
      mockPromotionRepository.createCoupon.mockResolvedValue(mockCoupon)

      const result = await promotionService.createCoupon('promo-cuid-1', {
        code: 'SUMMER10',
        maxUses: 100,
        perUserLimit: 1,
        isActive: true,
      })

      expect(result).toEqual(mockCoupon)
      expect(result.code).toBe('SUMMER10')
    })

    it('should throw 404 if promotion not found', async () => {
      mockPromotionRepository.findById.mockResolvedValue(null)

      await expect(
        promotionService.createCoupon('nonexistent', {
          code: 'CODE',
          perUserLimit: 1,
          isActive: true,
        }),
      ).rejects.toThrow(new AppError('Promotion not found', 404))
    })
  })

  describe('deleteCoupon', () => {
    it('should delete coupon and return message', async () => {
      mockPromotionRepository.findById.mockResolvedValue(mockPromotion)
      mockPromotionRepository.findCouponById.mockResolvedValue({
        ...mockCoupon,
        promotionId: 'promo-cuid-1',
      })
      mockPromotionRepository.deleteCoupon.mockResolvedValue(mockCoupon)

      const result = await promotionService.deleteCoupon('promo-cuid-1', 'coupon-cuid-1')

      expect(result).toEqual({ message: 'Coupon deleted successfully' })
    })

    it('should throw 404 if coupon not found', async () => {
      mockPromotionRepository.findById.mockResolvedValue(mockPromotion)
      mockPromotionRepository.findCouponById.mockResolvedValue(null)

      await expect(
        promotionService.deleteCoupon('promo-cuid-1', 'nonexistent'),
      ).rejects.toThrow(new AppError('Coupon not found', 404))
    })

    it('should throw 400 if coupon does not belong to promotion', async () => {
      mockPromotionRepository.findById.mockResolvedValue(mockPromotion)
      mockPromotionRepository.findCouponById.mockResolvedValue({
        ...mockCoupon,
        promotionId: 'other-promo-id',
      })

      await expect(
        promotionService.deleteCoupon('promo-cuid-1', 'coupon-cuid-1'),
      ).rejects.toThrow(new AppError('Coupon does not belong to this promotion', 400))
    })
  })

  describe('validateCoupon', () => {
    it('should validate a valid coupon', async () => {
      mockPromotionRepository.findCouponByCode.mockResolvedValue(makeCouponWithRelations())

      const result = await promotionService.validateCoupon(
        { code: 'SUMMER10', basketId: 'basket-1' },
        1,
      )

      expect(result.valid).toBe(true)
      expect(result.code).toBe('SUMMER10')
    })

    it('should throw 404 if coupon code not found', async () => {
      mockPromotionRepository.findCouponByCode.mockResolvedValue(null)

      await expect(
        promotionService.validateCoupon({ code: 'INVALID', basketId: 'basket-1' }, 1),
      ).rejects.toThrow(new AppError('Invalid coupon code', 404))
    })

    it('should throw 400 if coupon is not active', async () => {
      mockPromotionRepository.findCouponByCode.mockResolvedValue(
        makeCouponWithRelations({ isActive: false }),
      )

      await expect(
        promotionService.validateCoupon({ code: 'SUMMER10', basketId: 'basket-1' }, 1),
      ).rejects.toThrow(new AppError('This coupon is not active', 400))
    })

    it('should throw 400 if promotion is not active', async () => {
      mockPromotionRepository.findCouponByCode.mockResolvedValue(
        makeCouponWithRelations({
          promotion: {
            id: 'promo-cuid-1',
            name: 'Summer Sale',
            slug: 'summer-sale',
            isActive: false,
            discounts: [],
          },
        } as any),
      )

      await expect(
        promotionService.validateCoupon({ code: 'SUMMER10', basketId: 'basket-1' }, 1),
      ).rejects.toThrow(new AppError('The promotion linked to this coupon is not active', 400))
    })

    it('should throw 400 if coupon has reached max uses', async () => {
      mockPromotionRepository.findCouponByCode.mockResolvedValue(
        makeCouponWithRelations({ maxUses: 10, usedCount: 10 }),
      )

      await expect(
        promotionService.validateCoupon({ code: 'SUMMER10', basketId: 'basket-1' }, 1),
      ).rejects.toThrow(new AppError('This coupon has reached its maximum usage limit', 400))
    })

    it('should throw 400 if user has already used the coupon the maximum times', async () => {
      mockPromotionRepository.findCouponByCode.mockResolvedValue(
        makeCouponWithRelations({
          perUserLimit: 1,
          uses: [{ userId: 1 }],
        }),
      )

      await expect(
        promotionService.validateCoupon({ code: 'SUMMER10', basketId: 'basket-1' }, 1),
      ).rejects.toThrow(
        new AppError('You have already used this coupon the maximum number of times', 400),
      )
    })
  })
})