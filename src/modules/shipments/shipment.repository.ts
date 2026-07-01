import { prisma } from "../../shared/config/database";
import { CreateShipmentDto, TrackingEventDto } from "./shipment.schema";
import { paginate } from "../../shared/utils/pagination";

const shipmentInclude = {
  trackingEvents: { orderBy: { createdAt: "desc" as const } },
  label: true,
};

export const shipmentRepository = {
  create: (
    data: CreateShipmentDto,
    trackingNumber: string,
    estimatedDeliveryDate: string,
  ) =>
    prisma.shipment.create({
      data: {
        senderName: data.sender_name,
        senderAddress: data.sender_address,
        recipientName: data.recipient_name,
        recipientAddress: data.recipient_address,
        weight: data.weight,
        ...(data.dimensions && { dimensions: data.dimensions as object }),
        ...(data.order_id && { orderId: data.order_id }),
        trackingNumber,
        estimatedDeliveryDate,
      },
      include: shipmentInclude,
    }),

  findById: (id: string) =>
    prisma.shipment.findUnique({ where: { id }, include: shipmentInclude }),

  findAll: (query: { page?: string; limit?: string; status?: string }) => {
    const { skip, take } = paginate(query);
    const where = {
      ...(query.status && { status: query.status as any }),
    };
    return Promise.all([
      prisma.shipment.findMany({
        where,
        skip,
        take,
        include: shipmentInclude,
        orderBy: { createdAt: "desc" },
      }),
      prisma.shipment.count({ where }),
    ]);
  },

  addTrackingEvent: (shipmentId: string, dto: TrackingEventDto) =>
    prisma.trackingEvent.create({
      data: { shipmentId, status: dto.status, location: dto.location },
    }),

  updateStatus: (
    id: string,
    status: "PENDING" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED",
  ) =>
    prisma.shipment.update({
      where: { id },
      data: { status },
      include: shipmentInclude,
    }),

  createLabel: (shipmentId: string, labelUrl: string) =>
    prisma.shippingLabel.create({ data: { shipmentId, labelUrl } }),

  findLabel: (shipmentId: string) =>
    prisma.shippingLabel.findUnique({ where: { shipmentId } }),
};

export const pickupRepository = {
  create: (
    userId: number,
    data: { pickupDate: string; pickupAddress: string },
  ) => prisma.pickupRequest.create({ data: { userId, ...data } }),

  findById: (id: string) => prisma.pickupRequest.findUnique({ where: { id } }),

  findAll: (query: { page?: string; limit?: string; status?: string }) => {
    const { skip, take } = paginate(query);
    const where = {
      ...(query.status && { status: query.status as any }),
    };
    return Promise.all([
      prisma.pickupRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.pickupRequest.count({ where }),
    ]);
  },

  cancel: (id: string) =>
    prisma.pickupRequest.update({
      where: { id },
      data: { status: "CANCELLED" },
    }),
};
