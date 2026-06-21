// tests/unit/payment.service.test.ts
import { paymentService } from "../../src/modules/payments/payment.service";
import { paymentRepository } from "../../src/modules/payments/payment.repository";
import { orderRepository } from "../../src/modules/orders/order.repository";
import { AppError } from "../../src/shared/utils/app-error";
import { makeOrder } from "../mocks/factories";

jest.mock("../../src/modules/payments/payment.repository");
jest.mock("../../src/modules/orders/order.repository");
jest.mock("../../src/shared/logger", () => ({
  businessLogger: { log: jest.fn() },
  auditLogger: { log: jest.fn() },
}));

const mockedPayRepo = paymentRepository as jest.Mocked<
  typeof paymentRepository
>;
const mockedOrderRepo = orderRepository as jest.Mocked<typeof orderRepository>;

describe("paymentService.getAvailableMethods", () => {
  it("retourne CASH_ON_DELIVERY comme disponible", () => {
    const methods = paymentService.getAvailableMethods();
    const cod = methods.find((m) => m.id === "CASH_ON_DELIVERY");
    expect(cod?.available).toBe(true);
  });

  it("retourne STRIPE, PAYPAL, CINETPAY comme indisponibles", () => {
    const methods = paymentService.getAvailableMethods();
    const unavailable = methods.filter((m) => m.id !== "CASH_ON_DELIVERY");
    expect(unavailable.every((m) => m.available === false)).toBe(true);
  });
});

describe("paymentService.create", () => {
  beforeEach(() => jest.clearAllMocks());

  const dto = {
    order_id: "order_1",
    method: "CASH_ON_DELIVERY",
    currency: "XAF",
  };

  it("rejette avec 503 si la méthode est indisponible (STRIPE)", async () => {
    await expect(
      paymentService.create(1, { ...dto, method: "STRIPE" } as any),
    ).rejects.toThrow(AppError);

    try {
      await paymentService.create(1, { ...dto, method: "STRIPE" } as any);
    } catch (e: any) {
      expect(e.statusCode).toBe(503);
    }
  });

  it("rejette si la commande est introuvable", async () => {
    mockedOrderRepo.findById.mockResolvedValue(null);
    await expect(paymentService.create(1, dto as any)).rejects.toThrow(
      "Order not found",
    );
  });

  it("rejette si la commande n'appartient pas à l'utilisateur (403)", async () => {
    mockedOrderRepo.findById.mockResolvedValue(makeOrder({ userId: 2 }) as any);
    await expect(paymentService.create(1, dto as any)).rejects.toThrow(
      "Forbidden",
    );
  });

  it("crée le paiement et confirme la commande", async () => {
    mockedOrderRepo.findById.mockResolvedValue(
      makeOrder({ userId: 1, totalAmount: 5000 }) as any,
    );
    mockedPayRepo.create.mockResolvedValue({
      id: "pay_1",
      amount: 5000,
    } as any);
    mockedOrderRepo.updateStatus.mockResolvedValue({} as any);

    const result = await paymentService.create(1, dto as any);

    expect(result.id).toBe("pay_1");
    expect(mockedOrderRepo.updateStatus).toHaveBeenCalledWith(
      "order_1",
      "CONFIRMED",
      null,
    );
  });
});

describe("paymentService.getById", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si paiement introuvable", async () => {
    mockedPayRepo.findById.mockResolvedValue(null);
    await expect(paymentService.getById("pay_99")).rejects.toThrow(AppError);
  });

  it("retourne le paiement", async () => {
    mockedPayRepo.findById.mockResolvedValue({ id: "pay_1" } as any);
    const result = await paymentService.getById("pay_1");
    expect(result.id).toBe("pay_1");
  });
});
