import { prisma } from "../../shared/config/database";
import { CreateShipmentDto, TrackingEventDto } from "./shipment.schema";
import { ShipmentStatus } from "@prisma/client";
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
        estimatedDeliveryDate: new Date(estimatedDeliveryDate),
      },
      include: shipmentInclude,
    }),

  findById: (id: string) =>
    prisma.shipment.findUnique({ where: { id }, include: shipmentInclude }),

  findByOrderId: (orderId: string) =>
    prisma.shipment.findFirst({
      where: { orderId },
      orderBy: { createdAt: "desc" },
    }),

  findAll: (query: {
    page?: string;
    limit?: string;
    status?: string;
    order_id?: string;
  }) => {
    const { skip, take } = paginate(query);
    const where = {
      ...(query.status && { status: query.status as any }),
      ...(query.order_id && { orderId: query.order_id }),
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

  // Entrée manuelle libre (ex: "Colis arrivé au tri Douala") — indépendante
  // d'un changement de statut officiel.
  addTrackingEvent: (shipmentId: string, dto: TrackingEventDto) =>
    prisma.trackingEvent.create({
      data: { shipmentId, status: dto.status, location: dto.location },
    }),

  updateStatus: (id: string, status: ShipmentStatus, reason?: string) =>
    prisma.$transaction(async (tx) => {
      await tx.trackingEvent.create({
        data: {
          shipmentId: id,
          status: reason ?? `Status automatically changed to ${status}`,
        },
      });

      return tx.shipment.update({
        where: { id },
        data: { status },
        include: shipmentInclude,
      });
    }),

  createLabel: (shipmentId: string, labelUrl: string) =>
    prisma.shippingLabel.create({ data: { shipmentId, labelUrl } }),

  findLabel: (shipmentId: string) =>
    prisma.shippingLabel.findUnique({ where: { shipmentId } }),
};
