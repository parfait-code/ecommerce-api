// tests/unit/user.service.test.ts
import { userService } from "../../src/modules/users/user.service";
import { userRepository } from "../../src/modules/users/user.repository";
import { authRepository } from "../../src/modules/auth/auth.repository";
import { AppError } from "../../src/shared/utils/app-error";
import { makeUser } from "../mocks/factories";

jest.mock("../../src/modules/users/user.repository");
jest.mock("../../src/modules/auth/auth.repository");
jest.mock("bcryptjs", () => ({ hash: jest.fn().mockResolvedValue("hashed") }));
jest.mock("../../src/shared/logger", () => ({
  businessLogger: { log: jest.fn() },
  auditLogger: { log: jest.fn() },
}));

const mockedUserRepo = userRepository as jest.Mocked<typeof userRepository>;
const mockedAuthRepo = authRepository as jest.Mocked<typeof authRepository>;

describe("userService.getProfile", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si utilisateur introuvable", async () => {
    mockedUserRepo.findById.mockResolvedValue(null);
    await expect(userService.getProfile(99)).rejects.toThrow(AppError);
  });

  it("retourne le profil sans le mot de passe", async () => {
    mockedUserRepo.findById.mockResolvedValue(makeUser({ id: 1 }) as any);
    const result = await userService.getProfile(1);
    expect(result).not.toHaveProperty("password");
  });
});

describe("userService.changeRole", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si utilisateur introuvable", async () => {
    mockedUserRepo.findById.mockResolvedValue(null);
    await expect(
      userService.changeRole(99, { role: "ADMIN" } as any),
    ).rejects.toThrow(AppError);
  });

  it("change le rôle et logge l'événement audit", async () => {
    mockedUserRepo.findById.mockResolvedValue(
      makeUser({ id: 1, role: "USER" }) as any,
    );
    mockedUserRepo.changeRole.mockResolvedValue(
      makeUser({ id: 1, role: "ADMIN" }) as any,
    );

    const { auditLogger } = await import("../../src/shared/logger");
    await userService.changeRole(1, { role: "ADMIN" } as any);

    expect(auditLogger.log).toHaveBeenCalledWith(
      "ROLE_CHANGED",
      expect.objectContaining({
        metadata: expect.objectContaining({
          oldRole: "USER",
          newRole: "ADMIN",
        }),
      }),
    );
  });
});

describe("userService.deleteUser", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si utilisateur introuvable", async () => {
    mockedUserRepo.findById.mockResolvedValue(null);
    await expect(userService.deleteUser(99)).rejects.toThrow(AppError);
  });

  it("supprime (soft delete) et retourne le compte", async () => {
    mockedUserRepo.findById.mockResolvedValue(makeUser({ id: 1 }) as any);
    mockedUserRepo.delete.mockResolvedValue({} as any);

    const result = await userService.deleteUser(1);
    expect(result.numberOfUsersDeleted).toBe(1);
  });
});

describe("userService.adminCreateUser", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette si username déjà pris", async () => {
    mockedAuthRepo.findByUsername.mockResolvedValue(makeUser() as any);
    await expect(
      userService.adminCreateUser({
        username: "johndoe",
        email: "new@example.com",
        password: "secret",
        firstName: "X",
        lastName: "Y",
        role: "USER",
      } as any),
    ).rejects.toThrow("Username already taken");
  });

  it("rejette si email déjà pris", async () => {
    mockedAuthRepo.findByUsername.mockResolvedValue(null);
    mockedAuthRepo.findByEmail.mockResolvedValue(makeUser() as any);

    await expect(
      userService.adminCreateUser({
        username: "newuser",
        email: "john@example.com",
        password: "secret",
        firstName: "X",
        lastName: "Y",
        role: "USER",
      } as any),
    ).rejects.toThrow("Email already taken");
  });

  it("crée l'utilisateur sans exposer le mot de passe", async () => {
    mockedAuthRepo.findByUsername.mockResolvedValue(null);
    mockedAuthRepo.findByEmail.mockResolvedValue(null);
    mockedAuthRepo.createUser.mockResolvedValue(makeUser({ id: 2 }) as any);

    const result = await userService.adminCreateUser({
      username: "newuser",
      email: "new@example.com",
      password: "secret",
      firstName: "X",
      lastName: "Y",
      role: "USER",
    } as any);

    expect(result).not.toHaveProperty("password");
  });
});
