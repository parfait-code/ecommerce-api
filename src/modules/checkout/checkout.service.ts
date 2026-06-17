import { checkoutRepository } from './checkout.repository'
import { basketRepository }   from '../basket/basket.repository'
import { orderRepository }    from '../orders/order.repository'
import { CreateCheckoutDto }  from './checkout.schema'
import { AppError }           from '../../shared/utils/app-error'
import { businessLogger }     from '../../shared/logger'

export const checkoutService = {
  create: async (userId: number, dto: CreateCheckoutDto) => {
    const basket = await basketRepository.findById(dto.basket_id)
    if (!basket) throw new AppError('Basket not found', 404)
    if (basket.items.length === 0) throw new AppError('Basket is empty', 400)

    const items = basket.items.map((i) => ({
      productId: i.productId,
      name:      i.product.name,
      price:     i.product.price,
      quantity:  i.quantity,
    }))

    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
    const checkout = await checkoutRepository.create(userId, dto, total, items)

    businessLogger.log('CHECKOUT_STARTED', {
      service: 'checkout',
      actor:   { userId, role: 'CUSTOMER' },
      target:  { checkoutId: checkout.id, basketId: dto.basket_id },
      metadata: { total, itemCount: items.length },
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
    if (checkout.status === 'COMPLETED') throw new AppError('Checkout already completed', 400)

    const items = (checkout.items as { productId: number; quantity: number; price: number }[])
      .map((i) => ({ productId: i.productId, quantity: i.quantity, price: i.price }))

    const order = await orderRepository.create(
      userId,
      {
        items: items.map((i) => ({ id: String(i.productId), quantity: i.quantity })),
        shippingAddress: checkout.shippingAddress as {
          street: string; city: string; country: string; postalCode: string
        },
        paymentMethodId: checkout.paymentMethodId ?? undefined,
      },
      checkout.total,
      items,
    )

    const completed = await checkoutRepository.complete(id, order.id)

    businessLogger.log('CHECKOUT_COMPLETED', {
      service: 'checkout',
      actor:   { userId, role: 'CUSTOMER' },
      target:  { checkoutId: id, orderId: order.id },
      metadata: { total: checkout.total },
    })

    return completed
  },
}