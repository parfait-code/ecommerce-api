import { pickupRequestRepository } from "./pickup-request.repository";
import { returnRepository } from "../returns/return.repository";
import { warehouseRepository } from "../warehouses/warehouse.repository";
import { addressRepository } from "../address/address.repository";
import {
  UpdatePickupLocationDto,
  UpdatePickupStatusDto,
} from "./pickup-request.schema";
import { AppError } from "../../shared/utils/app-error";
import { assertValidPickupTransition } from "./pickup-request.state-machine";
import { businessLogger, systemLogger } from "../../shared/logger";
import { ReturnStatus, PickupCollectionMethod } from "@prisma/client";

export const pickupRequestService = {
  getAll: async (query: {
    page?: string;
    limit?: string;
    status?: string;
    order_id?: string;
  }) => {
    const [items, total] = await pickupRequestRepository.findAll(query);
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  getById: async (id: string, userId: string, isAdmin: boolean) => {
    const request = await pickupRequestRepository.findById(id);
    if (!request) throw new AppError("Pickup request not found", 404);
    if (!isAdmin && request.userId !== userId)
      throw new AppError("Forbidden", 403);
    return request;
  },

  // Contrôle total admin — lieu de collecte modifiable tant que la demande
  // n'est pas dans un état terminal.
  updateLocation: async (id: string, dto: UpdatePickupLocationDto) => {
    const request = await pickupRequestRepository.findById(id);
    if (!request) throw new AppError("Pickup request not found", 404);
    if (["COMPLETED", "CANCELLED", "EXPIRED"].includes(request.status))
      throw new AppError(
        `Cannot change the collection location of a ${request.status.toLowerCase()} pickup request`,
        400,
      );

    if (dto.method === "WAREHOUSE_DROPOFF") {
      const warehouse = await warehouseRepository.findById(dto.warehouse_id!);
      if (!warehouse) throw new AppError("Warehouse not found", 404);
    }

    if (dto.method === "CUSTOM_ADDRESS") {
      const address = await addressRepository.findById(dto.address_id!);
      if (!address) throw new AppError("Address not found", 404);
    }

    const updated = await pickupRequestRepository.updateLocation(id, {
      method: dto.method as PickupCollectionMethod,
      addressId: dto.method === "CUSTOM_ADDRESS" ? dto.address_id : null,
      warehouseId: dto.method === "WAREHOUSE_DROPOFF" ? dto.warehouse_id : null,
      pickupDate: dto.pickup_date ? new Date(dto.pickup_date) : undefined,
      deadline: dto.deadline ? new Date(dto.deadline) : undefined,
    });

    businessLogger.log("PICKUP_LOCATION_UPDATED", {
      service: "pickup-requests",
      actor: { userId: null, role: "ADMIN" },
      target: { pickupRequestId: id },
      metadata: { method: dto.method },
    });

    return updated;
  },

  updateStatus: async (
    id: string,
    dto: UpdatePickupStatusDto,
    adminUserId: string,
  ) => {
    const request = await pickupRequestRepository.findById(id);
    if (!request) throw new AppError("Pickup request not found", 404);

    assertValidPickupTransition(request.status, dto.status);

    const updated = await pickupRequestRepository.updateStatus(
      id,
      dto.status,
      dto.notes,
    );

    businessLogger.log("PICKUP_STATUS_CHANGED", {
      service: "pickup-requests",
      actor: { userId: adminUserId, role: "ADMIN" },
      target: { pickupRequestId: id },
      metadata: { oldStatus: request.status, newStatus: dto.status },
    });

    // Une pickup annulée annule le retour associé — mais l'inverse n'est
    // pas automatique dans l'autre sens : COMPLETED sur la pickup NE marque
    // PAS le retour comme COMPLETED. Récupérer le colis ne garantit pas
    // qu'il sera accepté après inspection — l'admin garde cette décision
    // séparée via PUT /returns/:id/status (qui déclenche remboursement +
    // réintégration stock + reversal fidélité).
    if (dto.status === "CANCELLED" && request.returnRequestId) {
      await returnRepository.updateStatus(
        request.returnRequestId,
        ReturnStatus.CANCELLED,
        "Cancelled: pickup request cancelled by admin",
      );
    }

    return updated;
  },

  // Appelé uniquement par return.service.ts lors de l'approbation d'un
  // retour — pas de route publique de création.
  createFromReturn: async (params: {
    userId: string;
    returnRequestId: string;
    orderId: string;
    method: PickupCollectionMethod;
    addressId?: string | null;
    warehouseId?: string | null;
    deadline: Date;
  }) => {
    const created = await pickupRequestRepository.create(params);

    businessLogger.log("PICKUP_REQUEST_CREATED", {
      service: "pickup-requests",
      actor: { userId: params.userId, role: "CUSTOMER" },
      target: {
        pickupRequestId: created.id,
        returnRequestId: params.returnRequestId,
        orderId: params.orderId,
      },
      metadata: { method: params.method, deadline: params.deadline },
    });

    return created;
  },

  // Vérification paresseuse — appelée au début de getAll() (donc à chaque
  // consultation admin du dashboard) et exposable via un endpoint dédié
  // pour un cron externe. Aucun scheduler n'est en place dans ce projet
  // actuellement (pas de node-cron dans package.json) : sans consultation
  // admin régulière NI cron branché sur l'endpoint dédié, une demande
  // expirée peut rester PENDING plus longtemps que prévu avant d'être
  // détectée. À surveiller si le volume de retours devient significatif.
  expireOverdue: async (): Promise<number> => {
    const overdue = await pickupRequestRepository.findOverdue();

    for (const request of overdue) {
      await pickupRequestRepository.updateStatus(
        request.id,
        "EXPIRED",
        "Automatically expired: pickup deadline passed",
      );

      if (request.returnRequestId) {
        await returnRepository.updateStatus(
          request.returnRequestId,
          ReturnStatus.CANCELLED,
          "Automatically cancelled: pickup deadline passed",
        );
      }

      systemLogger.log("PICKUP_REQUEST_EXPIRED", {
        service: "pickup-requests",
        metadata: {
          pickupRequestId: request.id,
          returnRequestId: request.returnRequestId,
          orderId: request.orderId,
        },
      });
    }

    return overdue.length;
  },
};
