import { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'

declare global {
  namespace Express {
    interface Request {
      id: string
    }
  }
}

/**
 * Request ID Middleware
 * Génère un identifiant unique pour chaque requête (section 7)
 * Priorité : header x-request-id entrant (proxy, client) sinon UUID généré
 * Propage le requestId dans le header de réponse pour corrélation client-side
 */
export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const incoming = req.headers['x-request-id']
  req.id = (Array.isArray(incoming) ? incoming[0] : incoming) ?? `req_${randomUUID().replace(/-/g, '').substring(0, 12)}`
  res.setHeader('x-request-id', req.id)
  next()
}