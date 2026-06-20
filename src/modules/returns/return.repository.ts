import { prisma } from "../../shared/config/database";
import { CreateReturnDto } from "./return.schema";
import { ReturnStatus } from "@prisma/client";
import { paginate } from "../../shared/utils/pagination";

const returnInclude = {
  items: {
    include: {
      orderItem: {
        select: { id: true, productId: true, quantity: true, price: true },
      },
    },
  },
  order: { select: { id: true, userId: true, status: true } },
};

export const returnRepository = {
  findAll: (query: { status?: string; page?: string; limit?: string }) => {
    const { skip, take } = paginate(query);
    const where = {
      ...(query.status && { status: query.status as ReturnStatus }),
    };
    return Promise.all([
      prisma.returnRequest.findMany({
        where,
        skip,
        take,
        include: returnInclude,
        orderBy: { createdAt: "desc" },
      }),
      prisma.returnRequest.count({ where }),
    ]);
  },

  findById: (id: string) =>
    prisma.returnRequest.findUnique({ where: { id }, include: returnInclude }),

  findByOrder: (orderId: string) =>
    prisma.returnRequest.findMany({
      where: { orderId },
      include: returnInclude,
      orderBy: { createdAt: "desc" },
    }),

  create: (userId: number, dto: CreateReturnDto) =>
    prisma.returnRequest.create({
      data: {
        orderId: dto.order_id,
        userId,
        reason: dto.reason,
        notes: dto.notes,
        items: {
          create: dto.items.map((i) => ({
            orderItemId: i.order_item_id,
            quantity: i.quantity,
            condition: i.condition,
          })),
        },
      },
      include: returnInclude,
    }),

  updateStatus: (id: string, status: ReturnStatus, notes?: string) =>
    prisma.returnRequest.update({
      where: { id },
      data: { status, ...(notes !== undefined && { notes }) },
      include: returnInclude,
    }),
};
