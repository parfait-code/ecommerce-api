import { returnRepository } from "./return.repository";
import { orderRepository } from "../orders/order.repository";
import { orderService } from "../orders/order.service";
import { warehouseRepository } from "../warehouses/warehouse.repository";
import { addressRepository } from "../address/address.repository";
import { pickupRequestService } from "../pickup-requests/pickup-request.service";
import { CreateReturnDto, UpdateReturnStatusDto } from "./return.schema";
import { AppError } from "../../shared/utils/app-error";
import { businessLogger } from "../../shared/logger";
import { eventBus } from "../../shared/events/event-bus";
import { assertValidReturnTransition } from "./return.state-machine";
import { ReturnStatus } from "@prisma/client";

export const returnService = {
  getAll: async (query: { status?: string; page?: string; limit?: string }) => {
    const [items, total] = await returnRepository.findAll(query);
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  getById: async (id: string, userId: string, isAdmin: boolean) => {
    const returnRequest = await returnRepository.findById(id);
    if (!returnRequest) throw new AppError("Return request not found", 404);
    if (!isAdmin && returnRequest.userId !== userId)
      throw new AppError("Forbidden", 403);
    return returnRequest;
  },

  getByOrder: async (orderId: string, userId: string, isAdmin: boolean) => {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new AppError("Order not found", 404);
    if (!isAdmin && order.userId !== userId)
      throw new AppError("Forbidden", 403);
    return returnRepository.findByOrder(orderId);
  },

  create: async (userId: string, dto: CreateReturnDto) => {
    const order = await orderRepository.findById(dto.order_id);
    if (!order) throw new AppError("Order not found", 404);
    if (order.userId !== userId) throw new AppError("Forbidden", 403);

    if (order.status !== "DELIVERED")
      throw new AppError(
        "Returns can only be requested for delivered orders",
        400,
      );

    // Ajout — évite deux demandes chevauchantes sur la même commande, ce
    // qui compliquerait la logistique de pickup une fois branchée.
    const existing = await returnRepository.findByOrder(dto.order_id);
    if (existing.some((r) => r.status === "PENDING" || r.status === "APPROVED"))
      throw new AppError(
        "This order already has an active return request",
        409,
      );

    const orderItemIds = new Set(order.items.map((i) => i.id));
    const itemsWithQuantity: {
      order_item_id: string;
      quantity: number;
      condition?: string;
    }[] = [];

    for (const item of dto.items) {
      if (!orderItemIds.has(item.order_item_id))
        throw new AppError(
          `Order item ${item.order_item_id} does not belong to this order`,
          400,
        );

      const orderItem = order.items.find((i) => i.id === item.order_item_id)!;

      itemsWithQuantity.push({
        order_item_id: item.order_item_id,
        quantity: orderItem.quantity,
        condition: item.condition,
      });
    }

    if (dto.collection.method === "WAREHOUSE_DROPOFF") {
      const warehouse = await warehouseRepository.findById(
        dto.collection.warehouse_id!,
      );
      if (!warehouse) throw new AppError("Warehouse not found", 404);
    }

    if (dto.collection.method === "CUSTOM_ADDRESS") {
      const address = await addressRepository.findById(
        dto.collection.address_id!,
      );
      if (!address) throw new AppError("Address not found", 404);
      if (address.userId !== userId) throw new AppError("Forbidden", 403);
    }

    const returnRequest = await returnRepository.create(
      userId,
      dto,
      itemsWithQuantity,
    );

    businessLogger.log("RETURN_REQUESTED", {
      service: "returns",
      actor: { userId, role: "CUSTOMER" },
      target: { orderId: dto.order_id, returnRequestId: returnRequest.id },
      metadata: {
        reason: dto.reason,
        itemCount: itemsWithQuantity.length,
        collectionMethod: dto.collection.method,
      },
    });

    return returnRequest;
  },

  updateStatus: async (
    id: string,
    dto: UpdateReturnStatusDto,
    adminUserId: string,
  ) => {
    const returnRequest = await returnRepository.findById(id);
    if (!returnRequest) throw new AppError("Return request not found", 404);

    assertValidReturnTransition(returnRequest.status, dto.status);

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
          : dto.status === ReturnStatus.CANCELLED
            ? "RETURN_CANCELLED"
            : "RETURN_COMPLETED";

    businessLogger.log(event, {
      service: "returns",
      actor: { userId: adminUserId, role: "ADMIN" },
      target: { returnRequestId: id },
      metadata: { status: dto.status },
    });

    // Matérialise la pickup request au moment de l'approbation — la
    // deadline vient de la même requête que l'approbation elle-même.
    if (dto.status === ReturnStatus.APPROVED) {
      await pickupRequestService.createFromReturn({
        userId: returnRequest.userId,
        returnRequestId: id,
        orderId: returnRequest.orderId,
        method: returnRequest.collectionMethod,
        addressId:
          returnRequest.collectionMethod === "CUSTOM_ADDRESS"
            ? returnRequest.collectionAddressId
            : returnRequest.collectionMethod === "ORIGINAL_ADDRESS"
              ? returnRequest.order.shippingAddressId
              : null,
        warehouseId: returnRequest.collectionWarehouseId,
        deadline: new Date(dto.pickup_deadline!),
      });
    }

    if (dto.status === ReturnStatus.COMPLETED) {
      await orderService.updateStatus(
        returnRequest.orderId,
        { status: "REFUNDED", reason: `Return ${id} completed` },
        adminUserId,
        "ADMIN",
      );

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
