// tests/unit/shipment.service.test.ts
import { shipmentService } from "../../src/modules/shipments/shipment.service";
import {
  shipmentRepository,
  pickupRepository,
} from "../../src/modules/shipments/shipment.repository";
import { AppError } from "../../src/shared/utils/app-error";

jest.mock("../../src/modules/shipments/shipment.repository");
jest.mock("../../src/shared/logger", () => ({
  businessLogger: { log: jest.fn() },
}));

const mockedShipRepo = shipmentRepository as jest.Mocked<
  typeof shipmentRepository
>;
const mockedPickupRepo = pickupRepository as jest.Mocked<
  typeof pickupRepository
>;

const makeShipment = (overrides: Partial<any> = {}) => ({
  id: "ship_1",
  trackingNumber: "ABC123XYZ",
  estimatedDeliveryDate: "2026-07-01",
  status: "PENDING",
  senderName: "Alice",
  senderAddress: "Douala",
  recipientName: "Bob",
  recipientAddress: "Yaoundé",
  weight: 2,
  trackingEvents: [],
  label: null,
  ...overrides,
});

const makePickup = (overrides: Partial<any> = {}) => ({
  id: "pickup_1",
  userId: 1,
  pickupDate: new Date(),
  pickupAddress: "Douala",
  status: "PENDING",
  ...overrides,
});

describe("shipmentService.calculateCost", () => {
  it("calcule le coût : baseCost(5) + weight * 0.1", () => {
    const result = shipmentService.calculateCost({
      origin: "Douala",
      destination: "Yaoundé",
      weight: 10,
    } as any);

    expect(result.cost).toBe(6);
    expect(result.currency).toBe("XAF");
  });

  it("arrondit correctement le résultat", () => {
    const result = shipmentService.calculateCost({
      origin: "Douala",
      destination: "Yaoundé",
      weight: 3,
    } as any);

    expect(result.cost).toBe(5.3);
  });
});

describe("shipmentService.getAll", () => {
  beforeEach(() => jest.clearAllMocks());

  it("retourne une réponse paginée", async () => {
    mockedShipRepo.findAll.mockResolvedValue([[makeShipment()], 1] as any);

    const result = await shipmentService.getAll({ page: "1", limit: "20" });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
  });
});

describe("shipmentService.create", () => {
  beforeEach(() => jest.clearAllMocks());

  it("crée une expédition avec un trackingNumber généré", async () => {
    mockedShipRepo.create.mockResolvedValue(makeShipment()) as any;

    const result = await shipmentService.create({
      sender_name: "Alice",
      sender_address: "Douala",
      recipient_name: "Bob",
      recipient_address: "Yaoundé",
      weight: 2,
    } as any);

    expect(result.trackingNumber).toBeDefined();
    expect(mockedShipRepo.create).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.any(String),
    );
  });
});

describe("shipmentService.getById", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si introuvable", async () => {
    mockedShipRepo.findById.mockResolvedValue(null);
    await expect(shipmentService.getById("ship_99")).rejects.toThrow(
      "Shipment not found",
    );
  });

  it("retourne l'expédition", async () => {
    mockedShipRepo.findById.mockResolvedValue(makeShipment() as any);
    const result = await shipmentService.getById("ship_1");
    expect(result.id).toBe("ship_1");
  });
});

describe("shipmentService.addTrackingEvent", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si l'expédition est introuvable", async () => {
    mockedShipRepo.findById.mockResolvedValue(null);
    await expect(
      shipmentService.addTrackingEvent("ship_99", {
        status: "IN_TRANSIT",
      } as any),
    ).rejects.toThrow("Shipment not found");
  });

  it("ajoute l'événement et met à jour le statut", async () => {
    mockedShipRepo.findById
      .mockResolvedValueOnce(makeShipment() as any)
      .mockResolvedValueOnce(makeShipment({ status: "IN_TRANSIT" }) as any);
    mockedShipRepo.addTrackingEvent.mockResolvedValue({} as any);
    mockedShipRepo.updateStatus.mockResolvedValue(
      makeShipment({ status: "IN_TRANSIT" }) as any,
    );

    const result = await shipmentService.addTrackingEvent("ship_1", {
      status: "IN_TRANSIT",
      location: "Douala",
    } as any);

    expect(mockedShipRepo.addTrackingEvent).toHaveBeenCalled();
    expect(mockedShipRepo.updateStatus).toHaveBeenCalledWith(
      "ship_1",
      "IN_TRANSIT",
    );
    expect(result.status).toBe("IN_TRANSIT");
  });

  it("logge SHIPMENT_DELIVERED quand le statut passe à DELIVERED", async () => {
    mockedShipRepo.findById
      .mockResolvedValueOnce(makeShipment() as any)
      .mockResolvedValueOnce(makeShipment({ status: "DELIVERED" }) as any);
    mockedShipRepo.addTrackingEvent.mockResolvedValue({} as any);
    mockedShipRepo.updateStatus.mockResolvedValue(
      makeShipment({ status: "DELIVERED" }) as any,
    );

    const { businessLogger } = await import("../../src/shared/logger");
    await shipmentService.addTrackingEvent("ship_1", {
      status: "DELIVERED",
      location: "Yaoundé",
    } as any);

    expect(businessLogger.log).toHaveBeenCalledWith(
      "SHIPMENT_DELIVERED",
      expect.objectContaining({
        target: expect.objectContaining({ shipmentId: "ship_1" }),
      }),
    );
  });
});

describe("shipmentService.getTracking", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si introuvable", async () => {
    mockedShipRepo.findById.mockResolvedValue(null);
    await expect(shipmentService.getTracking("ship_99")).rejects.toThrow(
      "Shipment not found",
    );
  });

  it("retourne le statut courant et les événements", async () => {
    mockedShipRepo.findById.mockResolvedValue(
      makeShipment({
        status: "IN_TRANSIT",
        trackingEvents: [
          { location: "Douala", status: "IN_TRANSIT", createdAt: new Date() },
        ],
      }) as any,
    );

    const result = await shipmentService.getTracking("ship_1");

    expect(result.current_status).toBe("IN_TRANSIT");
    expect(result.current_location).toBe("Douala");
    expect(result.updates).toHaveLength(1);
  });

  it("retourne current_location null si aucun événement", async () => {
    mockedShipRepo.findById.mockResolvedValue(
      makeShipment({ trackingEvents: [] }) as any,
    );

    const result = await shipmentService.getTracking("ship_1");
    expect(result.current_location).toBeNull();
  });
});

describe("shipmentService.cancel", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si introuvable", async () => {
    mockedShipRepo.findById.mockResolvedValue(null);
    await expect(shipmentService.cancel("ship_99")).rejects.toThrow(
      "Shipment not found",
    );
  });

  it("rejette si déjà annulé", async () => {
    mockedShipRepo.findById.mockResolvedValue(
      makeShipment({ status: "CANCELLED" }) as any,
    );
    await expect(shipmentService.cancel("ship_1")).rejects.toThrow(
      "already cancelled",
    );
  });

  it("annule l'expédition avec succès", async () => {
    mockedShipRepo.findById.mockResolvedValue(makeShipment() as any);
    mockedShipRepo.updateStatus.mockResolvedValue(
      makeShipment({ status: "CANCELLED" }) as any,
    );

    const result = await shipmentService.cancel("ship_1");
    expect(result.status).toBe("CANCELLED");
  });
});

describe("shipmentService.getLabel", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si l'expédition est introuvable", async () => {
    mockedShipRepo.findById.mockResolvedValue(null);
    await expect(shipmentService.getLabel("ship_99")).rejects.toThrow(
      "Shipment not found",
    );
  });

  it("retourne le label existant sans en créer un nouveau", async () => {
    mockedShipRepo.findById.mockResolvedValue(makeShipment() as any);
    mockedShipRepo.findLabel.mockResolvedValue({
      id: "label_1",
      labelUrl: "https://labels.example.com/ship_1.pdf",
    } as any);

    const result = await shipmentService.getLabel("ship_1");

    expect(result.label_id).toBe("label_1");
    expect(mockedShipRepo.createLabel).not.toHaveBeenCalled();
  });

  it("crée un label s'il n'existe pas encore", async () => {
    mockedShipRepo.findById.mockResolvedValue(makeShipment() as any);
    mockedShipRepo.findLabel.mockResolvedValue(null);
    mockedShipRepo.createLabel.mockResolvedValue({
      id: "label_new",
      labelUrl: "https://labels.ecommerce-api.com/ship_1.pdf",
    } as any);

    const result = await shipmentService.getLabel("ship_1");

    expect(mockedShipRepo.createLabel).toHaveBeenCalledWith(
      "ship_1",
      expect.stringContaining("ship_1"),
    );
    expect(result.label_id).toBe("label_new");
  });
});

describe("shipmentService.createPickupRequest", () => {
  beforeEach(() => jest.clearAllMocks());

  it("crée la demande de collecte", async () => {
    mockedPickupRepo.create.mockResolvedValue(makePickup() as any);

    const result = await shipmentService.createPickupRequest(1, {
      pickup_date: new Date().toISOString(),
      pickup_address: "Douala",
    } as any);

    expect(result.id).toBe("pickup_1");
    expect(mockedPickupRepo.create).toHaveBeenCalledWith(1, {
      pickupDate: expect.any(String),
      pickupAddress: "Douala",
    });
  });
});

describe("shipmentService.getPickupRequest", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si introuvable", async () => {
    mockedPickupRepo.findById.mockResolvedValue(null);
    await expect(shipmentService.getPickupRequest("pickup_99")).rejects.toThrow(
      "Pickup request not found",
    );
  });

  it("retourne la demande", async () => {
    mockedPickupRepo.findById.mockResolvedValue(makePickup() as any);
    const result = await shipmentService.getPickupRequest("pickup_1");
    expect(result.id).toBe("pickup_1");
  });
});

describe("shipmentService.cancelPickupRequest", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si introuvable", async () => {
    mockedPickupRepo.findById.mockResolvedValue(null);
    await expect(
      shipmentService.cancelPickupRequest("pickup_99", 1),
    ).rejects.toThrow("Pickup request not found");
  });

  it("rejette si la demande n'appartient pas à l'utilisateur", async () => {
    mockedPickupRepo.findById.mockResolvedValue(
      makePickup({ userId: 2 }) as any,
    );
    await expect(
      shipmentService.cancelPickupRequest("pickup_1", 1),
    ).rejects.toThrow("Forbidden");
  });

  it("rejette si la demande est déjà annulée", async () => {
    mockedPickupRepo.findById.mockResolvedValue(
      makePickup({ userId: 1, status: "CANCELLED" }) as any,
    );
    await expect(
      shipmentService.cancelPickupRequest("pickup_1", 1),
    ).rejects.toThrow("already cancelled");
  });

  it("annule la demande avec succès", async () => {
    mockedPickupRepo.findById.mockResolvedValue(
      makePickup({ userId: 1 }) as any,
    );
    mockedPickupRepo.cancel.mockResolvedValue(
      makePickup({ status: "CANCELLED" }) as any,
    );

    const result = await shipmentService.cancelPickupRequest("pickup_1", 1);
    expect(result.status).toBe("CANCELLED");
  });
});
