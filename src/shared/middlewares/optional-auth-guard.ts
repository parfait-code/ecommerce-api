import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { JwtPayload } from "./auth-guard";

/**
 * Comme authGuard, mais ne bloque jamais la requête.
 * Si un token Bearer valide est présent, req.user est rempli (permet aux
 * controllers de détecter un admin) ; sinon la requête continue en anonyme,
 * sans erreur 401.
 */
export const optionalAuthGuard = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();

  try {
    const token = header.split(" ")[1];
    req.user = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    // Token invalide/expiré sur une route publique — on l'ignore silencieusement.
  }
  next();
};
