import { prisma } from '../../shared/config/database'
import { CreateOrderDto, UpdateOrderDto } from './order.schema'
import { paginate } from '../../shared/utils/pagination'

const orderInclude = {
  items: { include: { product: true } },
  user: { select: { id: true, username: true, email: true } },
}

export const orderRepository = {
  findAll: (query: { status?: string; customer?: string; page?: string; limit?: string }) => {
    const { skip, take } = paginate(query)
    const where = {
      ...(query.status && { status: query.status }),
      ...(query.customer && { user: { email: query.customer } }),
    }
    return Promise.all([
      prisma.order.findMany({ where, skip, take, include: orderInclude, orderBy: { createdAt: 'desc' } }),
      prisma.order.count({ where }),
    ])
  },

  findById: (id: string) =>
    prisma.order.findUnique({ where: { id }, include: orderInclude }),

  create: (
    userId: number,
    data: CreateOrderDto,
    totalAmount: number,
    items: { productId: number; quantity: number; price: number }[],
  ) =>
    prisma.order.create({
      data: {
        userId,
        shippingAddress: data.shippingAddress as object,
        ...(data.billingAddress && { billingAddress: data.billingAddress as object }),
        paymentMethodId: data.paymentMethodId,
        notes: data.notes,
        couponCode: data.couponCode,
        totalAmount,
        items: { create: items },
      },
      include: orderInclude,
    }),

  update: (id: string, data: UpdateOrderDto) =>
    prisma.order.update({
      where: { id },
      data: {
        ...(data.shippingAddress && { shippingAddress: data.shippingAddress as object }),
        ...(data.billingAddress && { billingAddress: data.billingAddress as object }),
        ...(data.notes && { notes: data.notes }),
      },
      include: orderInclude,
    }),

  updateStatus: (id: string, status: string) =>
    prisma.order.update({ where: { id }, data: { status }, include: orderInclude }),

  delete: (id: string) =>
    prisma.order.delete({ where: { id } }),
}