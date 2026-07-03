import { prisma } from "../../shared/config/database";
import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { paginate } from "../../shared/utils/pagination";

const paymentInclude = {
  order: true,
  user: {
    select: {
      id: true,
      username: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  },
};

export const paymentRepository = {
  create: (data: {
    orderId: string;
    userId: number;
    method: PaymentMethod;
    amount: number;
    currency: string;
    notes?: string;
  }) => prisma.payment.create({ data, include: paymentInclude }),

  findAll: (query: {
    page?: string;
    limit?: string;
    status?: string;
    method?: string;
    order_id?: string;
  }) => {
    const { skip, take } = paginate(query);
    const where = {
      ...(query.status && { status: query.status as any }),
      ...(query.method && { method: query.method as PaymentMethod }),
      ...(query.order_id && { orderId: query.order_id }),
    };
    return Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take,
        include: paymentInclude,
        orderBy: { createdAt: "desc" },
      }),
      prisma.payment.count({ where }),
    ]);
  },

  findById: (id: string) =>
    prisma.payment.findUnique({ where: { id }, include: paymentInclude }),

  findByOrderId: (orderId: string) =>
    prisma.payment.findMany({ where: { orderId }, include: paymentInclude }),

  updateStatus: (
    id: string,
    status: PaymentStatus,
    notes?: string,
  ) =>
    prisma.payment.update({
      where: { id },
      data: { status, ...(notes !== undefined && { notes }) },
      include: paymentInclude,
    }),
};