import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { securityLogger } from "../logger";
import { UserRole } from "@prisma/client";

export interface JwtPayload {
  userId: string;
  username: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authGuard = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    securityLogger.log("UNAUTHORIZED_ACCESS", {
      service: "auth-guard",
      requestId: req.id,
      actor: {
        userId: null,
        role: "ANONYMOUS",
        ip:
          (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
          req.socket.remoteAddress ??
          "unknown",
        userAgent: req.headers["user-agent"] ?? "unknown",
      },
      metadata: {
        reason: "Missing or malformed Authorization header",
        method: req.method,
        endpoint: req.originalUrl,
      },
    });
    return res.status(401).json({
      status: false,
      error: { message: "Auth headers not provided in the request." },
    });
  }

  try {
    const token = header.split(" ")[1];
    req.user = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    next();
  } catch (error) {
    const isExpired = error instanceof jwt.TokenExpiredError;
    const isMalformed = error instanceof jwt.JsonWebTokenError;

    securityLogger.log(
      isMalformed || isExpired ? "INVALID_JWT" : "TOKEN_TAMPERING",
      {
        service: "auth-guard",
        requestId: req.id,
        actor: {
          userId: null,
          role: "UNKNOWN",
          ip:
            (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
            req.socket.remoteAddress ??
            "unknown",
          userAgent: req.headers["user-agent"] ?? "unknown",
        },
        metadata: {
          reason: isExpired ? "Token expired" : "Invalid token signature",
          method: req.method,
          endpoint: req.originalUrl,
        },
      },
    );
    return res.status(401).json({
      status: false,
      error: { message: "Invalid or expired token." },
    });
  }
};
