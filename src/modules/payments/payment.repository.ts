import { prisma } from '../../shared/config/database'
import { PaymentMethod } from '@prisma/client'

const paymentInclude = {
  order: true,
  user: { select: { id: true, username: true, email: true } },
}

export const paymentRepository = {
  create: (data: {
    orderId: string
    userId: number
    method: PaymentMethod
    amount: number
    currency: string
    notes?: string
  }) => prisma.payment.create({ data, include: paymentInclude }),

  findById: (id: string) =>
    prisma.payment.findUnique({ where: { id }, include: paymentInclude }),

  findByOrderId: (orderId: string) =>
    prisma.payment.findMany({ where: { orderId }, include: paymentInclude }),

  updateStatus: (id: string, status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'CANCELLED') =>
    prisma.payment.update({ where: { id }, data: { status }, include: paymentInclude }),
}