import { orderRepository } from './order.repository'
import { productRepository } from '../products/product.repository'
import { CreateOrderDto, UpdateOrderDto, UpdateOrderStatusDto } from './order.schema'
import { AppError } from '../../shared/utils/app-error'
import { cache } from '../../shared/utils/cache'

const CACHE_KEYS = {
  all: (query: Record<string, string>) => `orders:all:${JSON.stringify(query)}`,
  single: (id: string) => `orders:${id}`,
}

export const orderService = {
  getAll: async (query: { status?: string; customer?: string; page?: string; limit?: string }) => {
    const cacheKey = CACHE_KEYS.all(query as Record<string, string>)
    const cached = await cache.get(cacheKey)
    if (cached) return cached

    const [items, total] = await orderRepository.findAll(query)
    const page = Number(query.page ?? 1)
    const limit = Number(query.limit ?? 20)
    const result = { items, total, page, limit, totalPages: Math.ceil(total / limit) }

    await cache.set(cacheKey, result)
    return result
  },

  getById: async (id: string) => {
    const cacheKey = CACHE_KEYS.single(id)
    const cached = await cache.get(cacheKey)
    if (cached) return cached

    const order = await orderRepository.findById(id)
    if (!order) throw new AppError('Order not found', 404)

    await cache.set(cacheKey, order)
    return order
  },

  create: async (userId: number, dto: CreateOrderDto) => {
    const orderItems: { productId: number; quantity: number; price: number }[] = []
    let totalAmount = 0

    for (const item of dto.items) {
      const product = await productRepository.findById(Number(item.id))
      if (!product) throw new AppError(`Product ${item.id} not found`, 404)
      orderItems.push({ productId: product.id, quantity: item.quantity, price: product.price })
      totalAmount += product.price * item.quantity
    }

    const order = await orderRepository.create(userId, dto, totalAmount, orderItems)
    await cache.delByPattern('orders:all:*')
    return order
  },

  update: async (id: string, dto: UpdateOrderDto) => {
    const order = await orderRepository.findById(id)
    if (!order) throw new AppError('Order not found', 404)
    const updated = await orderRepository.update(id, dto)
    await cache.del(CACHE_KEYS.single(id))
    await cache.delByPattern('orders:all:*')
    return updated
  },

  updateStatus: async (id: string, dto: UpdateOrderStatusDto) => {
    const order = await orderRepository.findById(id)
    if (!order) throw new AppError('Order not found', 404)
    const updated = await orderRepository.updateStatus(id, dto.status)
    await cache.del(CACHE_KEYS.single(id))
    await cache.delByPattern('orders:all:*')
    return updated
  },

  delete: async (id: string) => {
    const order = await orderRepository.findById(id)
    if (!order) throw new AppError('Order not found', 404)
    await orderRepository.delete(id)
    await cache.del(CACHE_KEYS.single(id))
    await cache.delByPattern('orders:all:*')
    return { message: 'Order cancelled successfully' }
  },
}