import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UserRole } from "@prisma/client";
import { authRepository } from "./auth.repository";
import { userRepository } from "../users/user.repository";
import { SignupDto, LoginDto } from "./auth.schema";
import { AppError } from "../../shared/utils/app-error";
import { env } from "../../shared/config/env";
import { businessLogger, securityLogger } from "../../shared/logger";
import { redis } from "../../shared/config/redis";
import { settingService } from "../settings/setting.service";
import { SETTING_KEYS } from "../settings/setting.constants";

const loginAttemptsKey = (username: string) => `login_attempts:${username}`;

export const authService = {
  signup: async (dto: SignupDto) => {
    const existingUser = await authRepository.findByUsername(dto.username);
    if (existingUser) throw new AppError("Username already taken", 409);

    const existingEmail = await authRepository.findByEmail(dto.email);
    if (existingEmail) throw new AppError("Email already taken", 409);

    const password = await bcrypt.hash(dto.password, 10);

    const user = await authRepository.createUser({
      username: dto.username,
      email: dto.email,
      password,
      firstName: dto.firstName,
      lastName: dto.lastName,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
      phone: dto.phone ?? null,
      role: UserRole.USER,
    });

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN },
    );

    businessLogger.log("USER_REGISTERED", {
      service: "auth",
      actor: { userId: user.id, role: "CUSTOMER" },
      target: { userId: user.id },
      metadata: { username: user.username, email: user.email },
    });

    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, token };
  },

  login: async (dto: LoginDto) => {
    const user = await authRepository.findByUsername(dto.username);

    if (!user) {
      securityLogger.log("FAILED_LOGIN", {
        service: "auth",
        actor: { userId: null, role: "ANONYMOUS" },
        metadata: { username: dto.username, reason: "User not found" },
      });
      throw new AppError(
        `Could not find any user with username: \`${dto.username}\`.`,
        400,
      );
    }

    if (!user.isActive) {
      securityLogger.log("FAILED_LOGIN", {
        service: "auth",
        actor: { userId: user.id, role: "CUSTOMER" },
        metadata: { username: dto.username, reason: "Account inactive" },
      });
      throw new AppError("This account has been deactivated.", 403);
    }

    const valid = await bcrypt.compare(dto.password, user.password);

    if (!valid) {
      securityLogger.log("FAILED_LOGIN", {
        service: "auth",
        actor: { userId: user.id, role: "CUSTOMER" },
        metadata: { username: dto.username, reason: "Wrong password" },
      });

      const [attemptLimit, windowSeconds] = await Promise.all([
        settingService.getNumber(SETTING_KEYS.SECURITY_LOGIN_ATTEMPT_LIMIT, 5),
        settingService.getNumber(
          SETTING_KEYS.SECURITY_LOGIN_ATTEMPT_WINDOW_SECONDS,
          900,
        ),
      ]);

      const key = loginAttemptsKey(dto.username);
      const attempts = await redis.incr(key);
      if (attempts === 1) {
        await redis.expire(key, windowSeconds);
      }

      if (attempts > 1 && attempts < attemptLimit) {
        securityLogger.log("MULTIPLE_FAILED_LOGINS", {
          service: "auth",
          actor: { userId: user.id, role: "CUSTOMER" },
          metadata: { username: dto.username, attempts },
        });
      }

      if (attempts >= attemptLimit) {
        await userRepository.setActive(user.id, false);
        await redis.del(key);

        securityLogger.log("BRUTE_FORCE_DETECTED", {
          service: "auth",
          actor: { userId: user.id, role: "CUSTOMER" },
          metadata: {
            username: dto.username,
            attempts,
            windowSeconds,
          },
        });

        businessLogger.log("ACCOUNT_LOCKED", {
          service: "auth",
          actor: { userId: null, role: "SYSTEM" },
          target: { userId: user.id },
          metadata: {
            reason: "Too many failed login attempts",
            attempts,
          },
        });
      }

      throw new AppError("Provided username and password did not match.", 400);
    }

    await redis.del(loginAttemptsKey(dto.username));

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN },
    );

    businessLogger.log("USER_LOGIN", {
      service: "auth",
      actor: {
        userId: user.id,
        role: user.role === "ADMIN" ? "ADMIN" : "CUSTOMER",
      },
      target: { userId: user.id },
      metadata: { username: user.username },
    });

    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, token };
  },
};
