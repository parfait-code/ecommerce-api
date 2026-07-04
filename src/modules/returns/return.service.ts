import { returnRepository } from "./return.repository";
import { orderRepository } from "../orders/order.repository";
import { orderService } from "../orders/order.service";
import { CreateReturnDto, UpdateReturnStatusDto } from "./return.schema";
import { AppError } from "../../shared/utils/app-error";
import { businessLogger } from "../../shared/logger";
import { eventBus } from "../../shared/events/event-bus";
import { ReturnStatus } from "@prisma/client";

export const returnService = {
  getAll: async (query: { status?: string; page?: string; limit?: string }) => {
    const [items, total] = await returnRepository.findAll(query);
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  getById: async (id: string, userId: number, isAdmin: boolean) => {
    const returnRequest = await returnRepository.findById(id);
    if (!returnRequest) throw new AppError("Return request not found", 404);
    if (!isAdmin && returnRequest.userId !== userId)
      throw new AppError("Forbidden", 403);
    return returnRequest;
  },

  getByOrder: async (orderId: string, userId: number, isAdmin: boolean) => {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new AppError("Order not found", 404);
    if (!isAdmin && order.userId !== userId)
      throw new AppError("Forbidden", 403);
    return returnRepository.findByOrder(orderId);
  },

  create: async (userId: number, dto: CreateReturnDto) => {
    const order = await orderRepository.findById(dto.order_id);
    if (!order) throw new AppError("Order not found", 404);
    if (order.userId !== userId) throw new AppError("Forbidden", 403);

    if (order.status !== "DELIVERED")
      throw new AppError(
        "Returns can only be requested for delivered orders",
        400,
      );

    const orderItemIds = new Set(order.items.map((i) => i.id));
    for (const item of dto.items) {
      if (!orderItemIds.has(item.order_item_id))
        throw new AppError(
          `Order item ${item.order_item_id} does not belong to this order`,
          400,
        );

      const orderItem = order.items.find((i) => i.id === item.order_item_id)!;
      if (item.quantity > orderItem.quantity)
        throw new AppError(
          `Return quantity exceeds purchased quantity for item ${item.order_item_id}`,
          400,
        );
    }

    const returnRequest = await returnRepository.create(userId, dto);

    businessLogger.log("RETURN_REQUESTED", {
      service: "returns",
      actor: { userId, role: "CUSTOMER" },
      target: { orderId: dto.order_id, returnRequestId: returnRequest.id },
      metadata: { reason: dto.reason, itemCount: dto.items.length },
    });

    return returnRequest;
  },

  updateStatus: async (
    id: string,
    dto: UpdateReturnStatusDto,
    adminUserId: number,
  ) => {
    const returnRequest = await returnRepository.findById(id);
    if (!returnRequest) throw new AppError("Return request not found", 404);
    if (returnRequest.status === ReturnStatus.COMPLETED)
      throw new AppError("This return request is already completed", 400);

    const updated = await returnRepository.updateStatus(
      id,
      dto.status,
      dto.notes,
    );

    const event =
      dto.status === ReturnStatus.APPROVED
        ? "RETURN_APPROVED"
        : dto.status === ReturnStatus.REJECTED
          ? "RETURN_REJECTED"
          : "RETURN_COMPLETED";

    businessLogger.log(event, {
      service: "returns",
      actor: { userId: adminUserId, role: "ADMIN" },
      target: { returnRequestId: id },
      metadata: { status: dto.status },
    });

    if (dto.status === ReturnStatus.COMPLETED) {
      await orderService.updateStatus(
        returnRequest.orderId,
        { status: "REFUNDED", reason: `Return ${id} completed` },
        adminUserId,
        "ADMIN",
      );

      // Émission — déclenche R2 (remboursement paiement), R3 (réintégration
      // stock) et R4 (reversal fidélité) de façon découplée.
      eventBus.emit("return.status.changed", {
        returnRequestId: id,
        orderId: returnRequest.orderId,
        userId: returnRequest.userId,
        fromStatus: returnRequest.status,
        toStatus: dto.status,
        items: returnRequest.items.map((i) => ({
          orderItemId: i.orderItemId,
          quantity: i.quantity,
        })),
      });
    }

    return updated;
  },
};
