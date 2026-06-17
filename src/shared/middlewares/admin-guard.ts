import { Request, Response, NextFunction } from 'express'
import { securityLogger } from '../logger'

export const adminGuard = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') {
    securityLogger.log('FORBIDDEN_ACCESS', {
      service: 'admin-guard',
      requestId: req.id,
      actor: {
        userId:    req.user?.userId    ?? null,
        role:      req.user ? 'CUSTOMER' : 'ANONYMOUS',
        ip:        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
                   ?? req.socket.remoteAddress
                   ?? 'unknown',
        userAgent: req.headers['user-agent'] ?? 'unknown',
      },
      metadata: {
        reason:      'Admin role required',
        currentRole: req.user?.role ?? 'none',
        method:      req.method,
        endpoint:    req.originalUrl,
      },
    })

    return res.status(403).json({
      status: false,
      error: { message: 'You need to be a admin to access this endpoint.' },
    })
  }

  next()
}