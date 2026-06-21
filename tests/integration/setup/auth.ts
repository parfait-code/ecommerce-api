import jwt from "jsonwebtoken";
import { env } from "../../../src/shared/config/env";

export const makeToken = (payload: {
  userId: number;
  username: string;
  role: "USER" | "ADMIN" | "MANAGER" | "SUPPORT";
}) => jwt.sign(payload, env.JWT_SECRET, { expiresIn: 3600 });

export const adminToken = (userId: number) =>
  makeToken({ userId, username: "admin_test", role: "ADMIN" });

export const userToken = (userId: number) =>
  makeToken({ userId, username: "user_test", role: "USER" });
