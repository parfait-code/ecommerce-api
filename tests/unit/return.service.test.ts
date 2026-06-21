// tests/unit/return.service.test.ts
import { returnService } from "../../src/modules/returns/return.service";
import { returnRepository } from "../../src/modules/returns/return.repository";
import { orderRepository } from "../../src/modules/orders/order.repository";
import { AppError } from "../../src/shared/utils/app-error";
import { makeOrder } from "../mocks/factories";

jest.mock("../../src/modules/returns/return.repository");
jest.mock("../../src/modules/orders/order.repository");
jest.mock("../../src/shared/logger", () => ({
  businessLogger: { log: jest.fn() },
  auditLogger: { log: jest.fn() },
}));

const mockedReturnRepo = returnRepository as jest.Mocked<
  typeof returnRepository
>;
const mockedOrderRepo = orderRepository as jest.Mocked<typeof orderRepository>;

const makeReturnRequest = (overrides: Partial<any> = {}) => ({
  id: "ret_1",
  orderId: "order_1",
  userId: 1,
  status: "PENDING",
  reason: "Produit défectueux",
  items: [],
  order: { id: "order_1", userId: 1, status: "DELIVERED" },
  ...overrides,
});

describe("returnService.getById", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si introuvable", async () => {
    mockedReturnRepo.findById.mockResolvedValue(null);
    await expect(returnService.getById("ret_99", 1, false)).rejects.toThrow(
      AppError,
    );
  });

  it("rejette si l'utilisateur n'est pas le propriétaire et n'est pas admin", async () => {
    mockedReturnRepo.findById.mockResolvedValue(
      makeReturnRequest({ userId: 2 }) as any,
    );
    await expect(returnService.getById("ret_1", 1, false)).rejects.toThrow(
      "Forbidden",
    );
  });

  it("autorise un admin à voir n'importe quel retour", async () => {
    mockedReturnRepo.findById.mockResolvedValue(
      makeReturnRequest({ userId: 2 }) as any,
    );
    const result = await returnService.getById("ret_1", 1, true);
    expect(result.id).toBe("ret_1");
  });
});

describe("returnService.create", () => {
  beforeEach(() => jest.clearAllMocks());

  const dto = {
    order_id: "order_1",
    reason: "Produit cassé",
    items: [{ order_item_id: "item_1", quantity: 1 }],
  };

  it("rejette si la commande est introuvable", async () => {
    mockedOrderRepo.findById.mockResolvedValue(null);
    await expect(returnService.create(1, dto as any)).rejects.toThrow(
      "Order not found",
    );
  });

  it("rejette si la commande n'appartient pas à l'utilisateur", async () => {
    mockedOrderRepo.findById.mockResolvedValue(makeOrder({ userId: 2 }) as any);
    await expect(returnService.create(1, dto as any)).rejects.toThrow(
      "Forbidden",
    );
  });

  it("rejette si un order_item_id n'appartient pas à la commande", async () => {
    mockedOrderRepo.findById.mockResolvedValue(
      makeOrder({
        userId: 1,
        items: [{ id: "item_other", quantity: 2 }],
      }) as any,
    );
    await expect(returnService.create(1, dto as any)).rejects.toThrow(
      "does not belong to this order",
    );
  });

  it("rejette si la quantité demandée dépasse la quantité achetée", async () => {
    mockedOrderRepo.findById.mockResolvedValue(
      makeOrder({
        userId: 1,
        items: [{ id: "item_1", quantity: 1 }],
      }) as any,
    );
    const dtoOver = {
      ...dto,
      items: [{ order_item_id: "item_1", quantity: 5 }],
    };
    await expect(returnService.create(1, dtoOver as any)).rejects.toThrow(
      "exceeds purchased quantity",
    );
  });

  it("crée le retour avec succès", async () => {
    mockedOrderRepo.findById.mockResolvedValue(
      makeOrder({
        userId: 1,
        items: [{ id: "item_1", quantity: 2 }],
      }) as any,
    );
    mockedReturnRepo.create.mockResolvedValue(makeReturnRequest() as any);

    const result = await returnService.create(1, dto as any);
    expect(result.id).toBe("ret_1");
  });
});

describe("returnService.updateStatus", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si le retour est introuvable", async () => {
    mockedReturnRepo.findById.mockResolvedValue(null);
    await expect(
      returnService.updateStatus("ret_99", { status: "APPROVED" } as any, 1),
    ).rejects.toThrow(AppError);
  });

  it("rejette si le retour est déjà COMPLETED", async () => {
    mockedReturnRepo.findById.mockResolvedValue(
      makeReturnRequest({ status: "COMPLETED" }) as any,
    );
    await expect(
      returnService.updateStatus("ret_1", { status: "APPROVED" } as any, 1),
    ).rejects.toThrow("already completed");
  });

  it("met à jour le statut avec succès", async () => {
    mockedReturnRepo.findById.mockResolvedValue(makeReturnRequest() as any);
    mockedReturnRepo.updateStatus.mockResolvedValue(
      makeReturnRequest({ status: "APPROVED" }) as any,
    );

    const result = await returnService.updateStatus(
      "ret_1",
      { status: "APPROVED" } as any,
      1,
    );
    expect(result.status).toBe("APPROVED");
  });
});
