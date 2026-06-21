import { loyaltyService } from "../../src/modules/loyalty/loyalty.service";
import { loyaltyRepository } from "../../src/modules/loyalty/loyalty.repository";
import { userRepository } from "../../src/modules/users/user.repository";
import { AppError } from "../../src/shared/utils/app-error";
import { makeUser, makeLoyaltyTransaction } from "../mocks/factories";

jest.mock("../../src/modules/loyalty/loyalty.repository");
jest.mock("../../src/modules/users/user.repository");

const mockedRepo = loyaltyRepository as jest.Mocked<typeof loyaltyRepository>;
const mockedUserRepo = userRepository as jest.Mocked<typeof userRepository>;

describe("loyaltyService.getBalance", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si utilisateur introuvable", async () => {
    mockedUserRepo.findById.mockResolvedValue(null);
    await expect(loyaltyService.getBalance(99)).rejects.toThrow(AppError);
  });

  it("retourne le solde", async () => {
    mockedUserRepo.findById.mockResolvedValue(makeUser({ id: 1 }) as any);
    mockedRepo.getBalance.mockResolvedValue(350);

    const result = await loyaltyService.getBalance(1);
    expect(result).toEqual({ userId: 1, balance: 350 });
  });
});

describe("loyaltyService.earnFromOrder", () => {
  beforeEach(() => jest.clearAllMocks());

  it("crédite des points proportionnels au montant (1% du total)", async () => {
    mockedRepo.create.mockResolvedValue(
      makeLoyaltyTransaction({ points: 50 }) as any,
    );

    await loyaltyService.earnFromOrder(1, "order_1", 5000);

    expect(mockedRepo.create).toHaveBeenCalledWith({
      userId: 1,
      orderId: "order_1",
      points: 50,
      type: "EARNED",
    });
  });

  it("ne crée aucune transaction si le montant ne génère aucun point", async () => {
    const result = await loyaltyService.earnFromOrder(1, "order_1", 50);

    expect(result).toBeNull();
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });
});

describe("loyaltyService.adjust", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si utilisateur introuvable", async () => {
    mockedUserRepo.findById.mockResolvedValue(null);
    await expect(
      loyaltyService.adjust({
        userId: 99,
        points: 10,
        type: "ADJUSTED",
      } as any),
    ).rejects.toThrow(AppError);
  });

  it("rejette une redemption si le solde est insuffisant", async () => {
    mockedUserRepo.findById.mockResolvedValue(makeUser({ id: 1 }) as any);
    mockedRepo.getBalance.mockResolvedValue(20);

    await expect(
      loyaltyService.adjust({
        userId: 1,
        points: -50,
        type: "REDEEMED",
      } as any),
    ).rejects.toThrow("Insufficient loyalty points");
  });

  it("autorise une redemption si le solde est suffisant", async () => {
    mockedUserRepo.findById.mockResolvedValue(makeUser({ id: 1 }) as any);
    mockedRepo.getBalance.mockResolvedValue(100);
    mockedRepo.create.mockResolvedValue(
      makeLoyaltyTransaction({ points: -50, type: "REDEEMED" }) as any,
    );

    const result = await loyaltyService.adjust({
      userId: 1,
      points: -50,
      type: "REDEEMED",
    } as any);

    expect(result.points).toBe(-50);
  });

  it("autorise un ajustement EARNED/ADJUSTED sans vérifier le solde", async () => {
    mockedUserRepo.findById.mockResolvedValue(makeUser({ id: 1 }) as any);
    mockedRepo.create.mockResolvedValue(
      makeLoyaltyTransaction({ points: 200 }) as any,
    );

    await loyaltyService.adjust({
      userId: 1,
      points: 200,
      type: "ADJUSTED",
    } as any);

    expect(mockedRepo.getBalance).not.toHaveBeenCalled();
    expect(mockedRepo.create).toHaveBeenCalled();
  });
});
