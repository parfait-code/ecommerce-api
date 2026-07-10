import { prisma } from "../../shared/config/database";
import { PickupCollectionMethod, PickupStatus } from "@prisma/client";
import { paginate } from "../../shared/utils/pagination";

const pickupInclude = {
  address: true,
  warehouse: { select: { id: true, name: true, location: true } },
  returnRequest: { select: { id: true, status: true, orderId: true } },
};

export const pickupRequestRepository = {
  create: (data: {
    userId: number;
    returnRequestId: string;
    orderId: string;
    method: PickupCollectionMethod;
    addressId?: string | null;
    warehouseId?: string | null;
    deadline: Date;
  }) =>
    prisma.pickupRequest.create({
      data: {
        userId: data.userId,
        returnRequestId: data.returnRequestId,
        orderId: data.orderId,
        method: data.method,
        addressId: data.addressId ?? null,
        warehouseId: data.warehouseId ?? null,
        deadline: data.deadline,
      },
      include: pickupInclude,
    }),

  findById: (id: string) =>
    prisma.pickupRequest.findUnique({ where: { id }, include: pickupInclude }),

  findByReturnRequest: (returnRequestId: string) =>
    prisma.pickupRequest.findUnique({
      where: { returnRequestId },
      include: pickupInclude,
    }),

  findAll: (query: {
    page?: string;
    limit?: string;
    status?: string;
    order_id?: string;
  }) => {
    const { skip, take } = paginate(query);
    const where = {
      ...(query.status && { status: query.status as PickupStatus }),
      ...(query.order_id && { orderId: query.order_id }),
    };
    return Promise.all([
      prisma.pickupRequest.findMany({
        where,
        skip,
        take,
        include: pickupInclude,
        orderBy: { deadline: "asc" },
      }),
      prisma.pickupRequest.count({ where }),
    ]);
  },

  updateLocation: (
    id: string,
    data: {
      method: PickupCollectionMethod;
      addressId?: string | null;
      warehouseId?: string | null;
      pickupDate?: Date;
      deadline?: Date;
    },
  ) =>
    prisma.pickupRequest.update({
      where: { id },
      data: {
        method: data.method,
        addressId: data.addressId ?? null,
        warehouseId: data.warehouseId ?? null,
        ...(data.pickupDate && { pickupDate: data.pickupDate }),
        ...(data.deadline && { deadline: data.deadline }),
      },
      include: pickupInclude,
    }),

  updateStatus: (id: string, status: PickupStatus, notes?: string) =>
    prisma.pickupRequest.update({
      where: { id },
      data: { status, ...(notes !== undefined && { notes }) },
      include: pickupInclude,
    }),

  // Toutes les demandes non terminales dont le délai est dépassé.
  findOverdue: () =>
    prisma.pickupRequest.findMany({
      where: {
        status: { in: ["PENDING", "CONFIRMED"] },
        deadline: { lt: new Date() },
      },
      include: pickupInclude,
    }),
};
