import { userRepository } from "./user.repository";
import {
  UpdateUserDto,
  ChangeRoleDto,
  AdminCreateUserDto,
} from "./user.schema";
import { AppError } from "../../shared/utils/app-error";
import { businessLogger, auditLogger } from "../../shared/logger";
import { authRepository } from "../auth/auth.repository";
import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const strip = (user: Record<string, unknown>) => {
  const { password: _, ...rest } = user;
  return rest;
};

export const userService = {
  adminCreateUser: async (dto: AdminCreateUserDto) => {
    const existingUsername = await authRepository.findByUsername(dto.username);
    if (existingUsername) throw new AppError("Username already taken", 409);

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
      role: dto.role,
    });

    auditLogger.log("USER_CREATED", {
      service: "users",
      actor: { userId: null, role: "ADMIN" },
      target: { userId: user.id },
      metadata: { username: user.username, role: dto.role },
    });

    return strip(user as Record<string, unknown>);
  },

  getProfile: async (userId: string) => {
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError("User not found", 404);
    return strip(user as Record<string, unknown>);
  },

  updateProfile: async (userId: string, dto: UpdateUserDto) => {
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    const updated = await userRepository.update(userId, {
      ...dto,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
    });

    businessLogger.log("USER_UPDATED", {
      service: "users",
      actor: { userId, role: "CUSTOMER" },
      target: { userId },
      metadata: { fields: Object.keys(dto) },
    });

    return strip(updated as Record<string, unknown>);
  },

  getAllUsers: async () => {
    const users = await userRepository.findAll();
    return users.map((u) => strip(u as Record<string, unknown>));
  },

  changeRole: async (userId: string, dto: ChangeRoleDto) => {
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    const oldRole = user.role;
    const updated = await userRepository.changeRole(userId, dto.role);

    businessLogger.log("ROLE_CHANGED", {
      service: "users",
      actor: { userId, role: "ADMIN" },
      target: { userId },
      metadata: { oldRole, newRole: dto.role },
    });

    auditLogger.log("ROLE_CHANGED", {
      service: "users",
      actor: { userId, role: "ADMIN" },
      target: { userId },
      metadata: { oldRole, newRole: dto.role },
    });

    return strip(updated as Record<string, unknown>);
  },

  // U2 — un admin ne peut plus se supprimer lui-même
  deleteUser: async (userId: string, callerId: string) => {
    if (userId === callerId) {
      throw new AppError("You cannot delete your own account", 400);
    }

    const user = await userRepository.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    await userRepository.delete(userId);

    businessLogger.log("USER_DELETED", {
      service: "users",
      actor: { userId: callerId, role: "ADMIN" },
      target: { userId },
      metadata: { username: user.username },
    });

    auditLogger.log("USER_DELETED", {
      service: "users",
      actor: { userId: callerId, role: "ADMIN" },
      target: { userId },
      metadata: { username: user.username },
    });

    return { numberOfUsersDeleted: 1 };
  },

  // U2/U4 — suspension/réactivation réversible, indépendante de deletedAt.
  changeStatus: async (userId: string, callerId: string, isActive: boolean) => {
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    if (isActive === user.isActive) {
      return strip(user as Record<string, unknown>);
    }

    const updated = await userRepository.setActive(userId, isActive);

    businessLogger.log(isActive ? "ACCOUNT_UNLOCKED" : "ACCOUNT_LOCKED", {
      service: "users",
      actor: { userId: callerId, role: "ADMIN" },
      target: { userId },
      metadata: { reason: "Manual status change by admin" },
    });

    return strip(updated as Record<string, unknown>);
  },
};
