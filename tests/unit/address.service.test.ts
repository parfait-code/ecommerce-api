// tests/unit/address.service.test.ts
import { addressService } from "../../src/modules/address/address.service";
import { addressRepository } from "../../src/modules/address/address.repository";
import { AppError } from "../../src/shared/utils/app-error";

jest.mock("../../src/modules/address/address.repository");
jest.mock("../../src/shared/logger", () => ({
  businessLogger: { log: jest.fn() },
}));

const mockedRepo = addressRepository as jest.Mocked<typeof addressRepository>;

describe("addressService.validate", () => {
  it("retourne valid:true pour une adresse correcte", () => {
    const result = addressService.validate({
      street: "1 rue Test",
      city: "Douala",
      country: "CM",
      postal_code: "2345",
    });
    expect(result.valid).toBe(true);
    expect(result.normalized_address).not.toBeNull();
  });

  it("retourne valid:false pour un pays inconnu", () => {
    const result = addressService.validate({
      street: "1 rue Test",
      city: "Tokyo",
      country: "JP",
      postal_code: "1234",
    });
    expect(result.valid).toBe(false);
    expect(result.normalized_address).toBeNull();
  });

  it("retourne valid:false si street trop courte", () => {
    const result = addressService.validate({
      street: "A",
      city: "Douala",
      country: "CM",
      postal_code: "2345",
    });
    expect(result.valid).toBe(false);
  });
});

describe("addressService.getById", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si adresse introuvable", async () => {
    mockedRepo.findById.mockResolvedValue(null);
    await expect(addressService.getById("addr_99", 1)).rejects.toThrow(
      AppError,
    );
  });

  it("rejette si l'adresse n'appartient pas à l'utilisateur (403)", async () => {
    mockedRepo.findById.mockResolvedValue({ id: "addr_1", userId: 2 } as any);
    await expect(addressService.getById("addr_1", 1)).rejects.toThrow(
      "Forbidden",
    );
  });

  it("retourne l'adresse si le owner correspond", async () => {
    mockedRepo.findById.mockResolvedValue({ id: "addr_1", userId: 1 } as any);
    const result = await addressService.getById("addr_1", 1);
    expect(result.id).toBe("addr_1");
  });
});

describe("addressService.create", () => {
  beforeEach(() => jest.clearAllMocks());

  it("appelle unsetDefault si isDefault:true", async () => {
    mockedRepo.create.mockResolvedValue({ id: "addr_1", userId: 1 } as any);
    await addressService.create(1, {
      street: "Rue A",
      city: "Yaoundé",
      country: "CM",
      postalCode: "0000",
      isDefault: true,
    });
    expect(mockedRepo.unsetDefault).toHaveBeenCalledWith(1);
  });

  it("n'appelle pas unsetDefault si isDefault:false", async () => {
    mockedRepo.create.mockResolvedValue({ id: "addr_1", userId: 1 } as any);
    await addressService.create(1, {
      street: "Rue A",
      city: "Yaoundé",
      country: "CM",
      postalCode: "0000",
      isDefault: false,
    });
    expect(mockedRepo.unsetDefault).not.toHaveBeenCalled();
  });
});

describe("addressService.update", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si adresse introuvable", async () => {
    mockedRepo.findById.mockResolvedValue(null);
    await expect(addressService.update("addr_99", 1, {})).rejects.toThrow(
      AppError,
    );
  });

  it("rejette si l'adresse n'appartient pas à l'utilisateur", async () => {
    mockedRepo.findById.mockResolvedValue({ id: "addr_1", userId: 2 } as any);
    await expect(addressService.update("addr_1", 1, {})).rejects.toThrow(
      "Forbidden",
    );
  });

  it("appelle unsetDefault avant update si isDefault:true", async () => {
    mockedRepo.findById.mockResolvedValue({ id: "addr_1", userId: 1 } as any);
    mockedRepo.update.mockResolvedValue({ id: "addr_1", userId: 1 } as any);
    await addressService.update("addr_1", 1, { isDefault: true });
    expect(mockedRepo.unsetDefault).toHaveBeenCalledWith(1);
  });
});

describe("addressService.delete", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si adresse introuvable", async () => {
    mockedRepo.findById.mockResolvedValue(null);
    await expect(addressService.delete("addr_99", 1)).rejects.toThrow(AppError);
  });

  it("rejette si l'adresse n'appartient pas à l'utilisateur", async () => {
    mockedRepo.findById.mockResolvedValue({ id: "addr_1", userId: 2 } as any);
    await expect(addressService.delete("addr_1", 1)).rejects.toThrow(
      "Forbidden",
    );
  });

  it("supprime avec succès", async () => {
    mockedRepo.findById.mockResolvedValue({ id: "addr_1", userId: 1 } as any);
    const result = await addressService.delete("addr_1", 1);
    expect(result.message).toBe("Address deleted successfully");
    expect(mockedRepo.delete).toHaveBeenCalledWith("addr_1");
  });
});
