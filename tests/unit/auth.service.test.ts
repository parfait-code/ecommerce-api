import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { authService } from "../../src/modules/auth/auth.service";
import { authRepository } from "../../src/modules/auth/auth.repository";
import { AppError } from "../../src/shared/utils/app-error";
import { makeUser } from "../mocks/factories";

jest.mock("@/modules/auth/auth.repository");
jest.mock("@/shared/logger", () => ({
  businessLogger: { log: jest.fn() },
  securityLogger: { log: jest.fn() },
}));

const mockedRepo = authRepository as jest.Mocked<typeof authRepository>;

describe("authService.signup", () => {
  beforeEach(() => jest.clearAllMocks());

  it("crée un utilisateur et retourne un token", async () => {
    mockedRepo.findByUsername.mockResolvedValue(null);
    mockedRepo.findByEmail.mockResolvedValue(null);
    mockedRepo.createUser.mockResolvedValue(makeUser());

    const result = await authService.signup({
      username: "johndoe",
      email: "john@example.com",
      password: "secret123",
      firstName: "John",
      lastName: "Doe",
      role: "USER" as any,
    });

    expect(result.user).not.toHaveProperty("password");
    expect(typeof result.token).toBe("string");
    expect(mockedRepo.createUser).toHaveBeenCalledTimes(1);
  });

  it("rejette si username déjà pris", async () => {
    mockedRepo.findByUsername.mockResolvedValue(makeUser());

    await expect(
      authService.signup({
        username: "johndoe",
        email: "john@example.com",
        password: "secret123",
        firstName: "John",
        lastName: "Doe",
        role: "USER" as any,
      }),
    ).rejects.toThrow(AppError);
  });
});

describe("authService.login", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejette un mauvais mot de passe", async () => {
    const user = makeUser({ password: await bcrypt.hash("correct", 10) });
    mockedRepo.findByUsername.mockResolvedValue(user);

    await expect(
      authService.login({ username: "johndoe", password: "wrong" }),
    ).rejects.toThrow(AppError);
  });

  it("rejette un compte désactivé", async () => {
    mockedRepo.findByUsername.mockResolvedValue(makeUser({ isActive: false }));

    await expect(
      authService.login({ username: "johndoe", password: "whatever" }),
    ).rejects.toThrow("deactivated");
  });
});
