import { Request, Response, NextFunction } from 'express'
import { RequestContext, ActorRole } from '../logger'

declare global {
  namespace Express {
    interface Request {
      context: RequestContext
    }
  }
}

/**
 * Request Context Middleware (section 8)
 * Enrichit chaque requête avec un contexte standard :
 * requestId, userId, email, role, ip, userAgent
 * Doit être placé APRÈS request-id et APRÈS authGuard (optionnel)
 * Si l'utilisateur n'est pas authentifié, role = ANONYMOUS
 */
export const requestContext = (req: Request, _res: Response, next: NextFunction): void => {
  const role: ActorRole = req.user
    ? (req.user.role === 'admin' ? 'ADMIN' : 'CUSTOMER')
    : 'ANONYMOUS'

  req.context = {
    requestId: req.id,
    userId:    req.user?.userId ?? null,
    email:     null,
    role,
    ip:        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
               ?? req.socket.remoteAddress
               ?? 'unknown',
    userAgent: req.headers['user-agent'] ?? 'unknown',
  }

  next()
}