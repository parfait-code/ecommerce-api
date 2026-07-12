import jwt from "jsonwebtoken";
import { env } from "../../../src/shared/config/env";

export const makeToken = (payload: {
  userId: string;
  username: string;
  role: "USER" | "ADMIN" | "MANAGER" | "SUPPORT";
}) => jwt.sign(payload, env.JWT_SECRET, { expiresIn: 3600 });

export const adminToken = (userId: string) =>
  makeToken({ userId, username: "admin_test", role: "ADMIN" });

export const userToken = (userId: string) =>
  makeToken({ userId, username: "user_test", role: "USER" });
