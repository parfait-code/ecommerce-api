import { orderRepository } from './order.repository'
import { productRepository } from '../products/product.repository'
import { CreateOrderDto, UpdateOrderDto, UpdateOrderStatusDto } from './order.schema'
import { AppError } from '../../shared/utils/app-error'
import { paginate } from '../../shared/utils/pagination'

export const orderService = {
  getAll: async (query: { status?: string; customer?: string; page?: string; limit?: string }) => {
    const [items, total] = await orderRepository.findAll(query)
    const page = Number(query.page ?? 1)
    const limit = Number(query.limit ?? 20)
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) }
  },

  getById: async (id: string) => {
    const order = await orderRepository.findById(id)
    if (!order) throw new AppError('Order not found', 404)
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

    return orderRepository.create(userId, dto, totalAmount, orderItems)
  },

  update: async (id: string, dto: UpdateOrderDto) => {
    const order = await orderRepository.findById(id)
    if (!order) throw new AppError('Order not found', 404)
    return orderRepository.update(id, dto)
  },

  updateStatus: async (id: string, dto: UpdateOrderStatusDto) => {
    const order = await orderRepository.findById(id)
    if (!order) throw new AppError('Order not found', 404)
    return orderRepository.updateStatus(id, dto.status)
  },

  delete: async (id: string) => {
    const order = await orderRepository.findById(id)
    if (!order) throw new AppError('Order not found', 404)
    await orderRepository.delete(id)
    return { message: 'Order cancelled successfully' }
  },
}