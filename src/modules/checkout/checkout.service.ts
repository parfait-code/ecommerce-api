import { checkoutRepository }    from './checkout.repository'
import { basketRepository }      from '../basket/basket.repository'
import { orderRepository }       from '../orders/order.repository'
import { promotionRepository }   from '../promotions/promotion.repository'
import { CreateCheckoutDto }     from './checkout.schema'
import { AppError }              from '../../shared/utils/app-error'
import { businessLogger }        from '../../shared/logger'

// ── Helpers ───────────────────────────────────────────────────────────────────

interface BasketItemWithProduct {
  productId: number
  quantity:  number
  product: {
    id:         number
    name:       string
    price:      number
    categoryId: string
  }
}

interface DiscountRule {
  id:         string
  type:       string
  value:      number
  categoryId: string | null
  products:   { productId: number }[]
}

const applyDiscounts = (
  items:     BasketItemWithProduct[],
  discounts: DiscountRule[],
): { items: ReturnType<typeof buildCheckoutItems>; total: number; discountedTotal: number } => {
  const checkoutItems = buildCheckoutItems(items, discounts)
  const total           = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0)
  const discountedTotal = checkoutItems.reduce((sum, i) => sum + i.finalPrice * i.quantity, 0)
  return { items: checkoutItems, total, discountedTotal }
}

const buildCheckoutItems = (
  items:     BasketItemWithProduct[],
  discounts: DiscountRule[],
) =>
  items.map((i) => {
    const applicableDiscount = discounts.find((d) => {
      const targetsByCategory = d.categoryId === i.product.categoryId
      const targetsByProduct  = d.products.some((p) => p.productId === i.productId)
      return targetsByCategory || targetsByProduct
    })

    let finalPrice = i.product.price

    if (applicableDiscount) {
      if (applicableDiscount.type === 'PERCENTAGE') {
        finalPrice = i.product.price * (1 - applicableDiscount.value / 100)
      } else {
        finalPrice = Math.max(0, i.product.price - applicableDiscount.value)
      }
    }

    return {
      productId:          i.productId,
      name:               i.product.name,
      originalPrice:      i.product.price,
      finalPrice:         Math.round(finalPrice * 100) / 100,
      quantity:           i.quantity,
      discountApplied:    !!applicableDiscount,
      discountId:         applicableDiscount?.id ?? null,
    }
  })

const validateCoupon = async (
  code:   string,
  userId: number,
) => {
  const coupon = await promotionRepository.findCouponByCode(code)

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

  return coupon
}

// ── Service ───────────────────────────────────────────────────────────────────

export const checkoutService = {
  create: async (userId: number, dto: CreateCheckoutDto) => {
    const basket = await basketRepository.findById(dto.basket_id)
    if (!basket) throw new AppError('Basket not found', 404)
    if (basket.items.length === 0) throw new AppError('Basket is empty', 400)

    const basketItems = basket.items as unknown as BasketItemWithProduct[]

    let coupon:          Awaited<ReturnType<typeof validateCoupon>> | null = null
    let discountRules:   DiscountRule[] = []

    if (dto.coupon_code) {
      coupon       = await validateCoupon(dto.coupon_code, userId)
      discountRules = coupon.promotion.discounts as unknown as DiscountRule[]
    }

    const { items, total, discountedTotal } = applyDiscounts(basketItems, discountRules)

    const checkout = await checkoutRepository.create(
      userId,
      dto,
      total,
      discountedTotal,
      items,
      coupon?.id,
    )

    businessLogger.log('CHECKOUT_STARTED', {
      service:  'checkout',
      actor:    { userId, role: 'CUSTOMER' },
      target:   { checkoutId: checkout.id, basketId: dto.basket_id },
      metadata: {
        total,
        discountedTotal,
        itemCount:   items.length,
        couponCode:  dto.coupon_code ?? null,
        savings:     Math.round((total - discountedTotal) * 100) / 100,
      },
    })

    return checkout
  },

  getById: async (id: string) => {
    const checkout = await checkoutRepository.findById(id)
    if (!checkout) throw new AppError('Checkout not found', 404)
    return checkout
  },

  complete: async (id: string, userId: number) => {
    const checkout = await checkoutRepository.findById(id)
    if (!checkout) throw new AppError('Checkout not found', 404)
    if (checkout.userId !== userId) throw new AppError('Forbidden', 403)
    if (checkout.status === 'COMPLETED')
      throw new AppError('Checkout already completed', 400)

    const items = (
      checkout.items as {
        productId:  number
        quantity:   number
        finalPrice: number
      }[]
    ).map((i) => ({
      productId: i.productId,
      quantity:  i.quantity,
      price:     i.finalPrice,
    }))

    const order = await orderRepository.create(
      userId,
      {
        items: items.map((i) => ({
          id:       String(i.productId),
          quantity: i.quantity,
        })),
        shippingAddress: checkout.shippingAddress as {
          street: string; city: string; country: string; postalCode: string
        },
        paymentMethodId: checkout.paymentMethodId ?? undefined,
      },
      checkout.total,
      items,
      checkout.couponCodeId ?? undefined,
    )

    // Si un coupon a été appliqué, tracer son usage et incrémenter le compteur
    if (checkout.couponCodeId) {
      await promotionRepository.createCouponUse(
        checkout.couponCodeId,
        userId,
        order.id,
      )
      await promotionRepository.incrementCouponUsage(checkout.couponCodeId)
    }

    const completed = await checkoutRepository.complete(id, order.id)

    businessLogger.log('CHECKOUT_COMPLETED', {
      service:  'checkout',
      actor:    { userId, role: 'CUSTOMER' },
      target:   { checkoutId: id, orderId: order.id },
      metadata: {
        total:      checkout.total,
        couponUsed: !!checkout.couponCodeId,
      },
    })

    return completed
  },
}