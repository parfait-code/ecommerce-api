import { shipmentRepository, pickupRepository } from "./shipment.repository";
import { orderRepository } from "../orders/order.repository";
import {
  CreateShipmentDto,
  TrackingEventDto,
  UpdateShipmentStatusDto,
  ShippingCostDto,
  CreatePickupRequestDto,
} from "./shipment.schema";
import { AppError } from "../../shared/utils/app-error";
import { businessLogger } from "../../shared/logger";
import { eventBus } from "../../shared/events/event-bus";
import { ShipmentStatus } from "@prisma/client";

const generateTrackingNumber = () =>
  Math.random().toString(36).substring(2, 12).toUpperCase();

const generateEstimatedDelivery = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString();
};

export const shipmentService = {
  calculateCost: (dto: ShippingCostDto) => {
    const baseCost = 5;
    const weightCost = dto.weight * 0.1;
    const cost = baseCost + weightCost;
    return { cost: Math.round(cost * 100) / 100, currency: "XAF" };
  },

  getAll: async (query: {
    page?: string;
    limit?: string;
    status?: string;
    order_id?: string;
  }) => {
    const [items, total] = await shipmentRepository.findAll(query);
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  create: async (dto: CreateShipmentDto) => {
    const estimatedDeliveryDate =
      dto.estimated_delivery_at ?? generateEstimatedDelivery();

    const shipment = await shipmentRepository.create(
      dto,
      generateTrackingNumber(),
      estimatedDeliveryDate,
    );

    businessLogger.log("SHIPMENT_CREATED", {
      service: "shipments",
      actor: { userId: null, role: "CUSTOMER" },
      target: { shipmentId: shipment.id },
      metadata: {
        trackingNumber: shipment.trackingNumber,
        estimatedDeliveryDate: shipment.estimatedDeliveryDate,
        weight: dto.weight,
      },
    });

    return shipment;
  },

  getById: async (id: string) => {
    const shipment = await shipmentRepository.findById(id);
    if (!shipment) throw new AppError("Shipment not found", 404);
    return shipment;
  },

  // ── Nouveau : visibilité croisée commande → expédition ──
  getByOrder: async (orderId: string, userId: number, isAdmin: boolean) => {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new AppError("Order not found", 404);
    if (!isAdmin && order.userId !== userId)
      throw new AppError("Forbidden", 403);

    return shipmentRepository.findByOrderId(orderId); // null si aucune expédition encore créée
  },

  addTrackingEvent: async (id: string, dto: TrackingEventDto) => {
    const shipment = await shipmentRepository.findById(id);
    if (!shipment) throw new AppError("Shipment not found", 404);

    await shipmentRepository.addTrackingEvent(id, dto);

    if (dto.shipment_status) {
      await shipmentRepository.updateStatus(id, dto.shipment_status);

      businessLogger.log(
        dto.shipment_status === "DELIVERED"
          ? "SHIPMENT_DELIVERED"
          : "SHIPMENT_SENT",
        {
          service: "shipments",
          actor: { userId: null, role: "SYSTEM" },
          target: { shipmentId: id },
          metadata: { location: dto.location, status: dto.shipment_status },
        },
      );

      eventBus.emit("shipment.status.changed", {
        shipmentId: id,
        orderId: shipment.orderId ?? null,
        fromStatus: shipment.status,
        toStatus: dto.shipment_status,
      });
    }

    return shipmentRepository.findById(id);
  },

  updateStatus: async (id: string, dto: UpdateShipmentStatusDto) => {
    const shipment = await shipmentRepository.findById(id);
    if (!shipment) throw new AppError("Shipment not found", 404);

    if (shipment.status === "CANCELLED")
      throw new AppError("Cannot change status of a cancelled shipment", 400);
    if (shipment.status === "DELIVERED" && dto.status !== "DELIVERED")
      throw new AppError("Cannot change status of a delivered shipment", 400);

    const updated = await shipmentRepository.updateStatus(id, dto.status);

    if (dto.reason) {
      await shipmentRepository.addTrackingEvent(id, {
        status: dto.reason,
        location: undefined,
      });
    }

    if (dto.status === "DELIVERED") {
      businessLogger.log("SHIPMENT_DELIVERED", {
        service: "shipments",
        actor: { userId: null, role: "ADMIN" },
        target: { shipmentId: id },
        metadata: { reason: dto.reason },
      });
    }

    eventBus.emit("shipment.status.changed", {
      shipmentId: id,
      orderId: shipment.orderId ?? null,
      fromStatus: shipment.status,
      toStatus: dto.status,
    });

    return updated;
  },

  getTracking: async (id: string) => {
    const shipment = await shipmentRepository.findById(id);
    if (!shipment) throw new AppError("Shipment not found", 404);
    return {
      current_status: shipment.status,
      current_location: shipment.trackingEvents[0]?.location ?? null,
      updates: shipment.trackingEvents,
    };
  },

  cancel: async (id: string) => {
    const shipment = await shipmentRepository.findById(id);
    if (!shipment) throw new AppError("Shipment not found", 404);
    if (shipment.status === "CANCELLED")
      throw new AppError("Shipment already cancelled", 400);

    const cancelled = await shipmentRepository.updateStatus(id, "CANCELLED");

    businessLogger.log("SHIPMENT_FAILED", {
      service: "shipments",
      actor: { userId: null, role: "CUSTOMER" },
      target: { shipmentId: id },
      metadata: { reason: "Cancelled by user" },
    });

    return cancelled;
  },

  getLabel: async (shipmentId: string) => {
    const shipment = await shipmentRepository.findById(shipmentId);
    if (!shipment) throw new AppError("Shipment not found", 404);

    let label = await shipmentRepository.findLabel(shipmentId);
    if (!label) {
      label = await shipmentRepository.createLabel(
        shipmentId,
        `https://labels.ecommerce-api.com/${shipmentId}.pdf`,
      );
    }
    return { label_id: label.id, label_url: label.labelUrl };
  },

  createPickupRequest: (userId: number, dto: CreatePickupRequestDto) =>
    pickupRepository.create(userId, {
      pickupDate: dto.pickup_date,
      pickupAddress: dto.pickup_address,
      orderId: dto.order_id,
      shipmentId: dto.shipment_id,
    }),

  getAllPickupRequests: async (query: {
    page?: string;
    limit?: string;
    status?: string;
  }) => {
    const [items, total] = await pickupRepository.findAll(query);
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  getPickupRequest: async (id: string) => {
    const request = await pickupRepository.findById(id);
    if (!request) throw new AppError("Pickup request not found", 404);
    return request;
  },

  cancelPickupRequest: async (id: string, userId: number) => {
    const request = await pickupRepository.findById(id);
    if (!request) throw new AppError("Pickup request not found", 404);
    if (request.userId !== userId) throw new AppError("Forbidden", 403);
    if (request.status === "CANCELLED")
      throw new AppError("Pickup request already cancelled", 400);
    return pickupRepository.cancel(id);
  },
};
