import { prisma } from '../../shared/config/database'
import { CreateCheckoutDto } from './checkout.schema'

const checkoutInclude = {
  user: { select: { id: true, username: true, email: true } },
}

export const checkoutRepository = {
  create: (userId: number, dto: CreateCheckoutDto, total: number, items: unknown[]) =>
    prisma.checkout.create({
      data: {
        userId,
        basketId: dto.basket_id,
        shippingAddress: dto.shipping_address as object,
        ...(dto.billing_address && { billingAddress: dto.billing_address as object }),
        paymentMethodId: dto.payment_method_id,
        total,
        items: items as object[],
      },
      include: checkoutInclude,
    }),

  findById: (id: string) =>
    prisma.checkout.findUnique({ where: { id }, include: checkoutInclude }),

  complete: (id: string, orderId: string) =>
    prisma.checkout.update({
      where: { id },
      data: { status: 'COMPLETED', orderId },
      include: checkoutInclude,
    }),
}