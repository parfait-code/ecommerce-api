import { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/app-error'
import { errorLogger, securityLogger } from '../logger'

/**
 * Error Handler Middleware
 * Remplace l'ancien handler qui utilisait logger.warn/logger.error global.
 * - 401 → securityLogger UNAUTHORIZED_ACCESS
 * - 403 → securityLogger FORBIDDEN_ACCESS
 * - AppError autres → errorLogger avec event typé
 * - Erreurs inconnues → errorLogger UNHANDLED_ERROR
 */
export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const ctx = req.context
  const requestId = ctx?.requestId ?? req.id ?? null

  const actor = {
    userId:    ctx?.userId    ?? null,
    role:      ctx?.role      ?? 'ANONYMOUS' as const,
    ip:        ctx?.ip        ?? 'unknown',
    userAgent: ctx?.userAgent ?? 'unknown',
  }

  if (err instanceof AppError) {
    // ── Événements de sécurité ───────────────────────────────────────────────
    if (err.statusCode === 401) {
      securityLogger.log('UNAUTHORIZED_ACCESS', {
        service: 'error-handler',
        requestId,
        actor,
        metadata: {
          message:    err.message,
          method:     req.method,
          endpoint:   req.originalUrl,
          statusCode: err.statusCode,
        },
      })
    } else if (err.statusCode === 403) {
      securityLogger.log('FORBIDDEN_ACCESS', {
        service: 'error-handler',
        requestId,
        actor,
        metadata: {
          message:    err.message,
          method:     req.method,
          endpoint:   req.originalUrl,
          statusCode: err.statusCode,
        },
      })
    } else {
      // ── Erreurs applicatives connues ─────────────────────────────────────
      errorLogger.log(
        err.statusCode === 404 ? 'NOT_FOUND_ERROR'
        : err.statusCode === 400 ? 'VALIDATION_ERROR'
        : 'INTERNAL_ERROR',
        {
          service: 'error-handler',
          requestId,
          actor,
          metadata: {
            message:    err.message,
            method:     req.method,
            endpoint:   req.originalUrl,
            statusCode: err.statusCode,
          },
        },
      )
    }

    res.status(err.statusCode).json({
      status: false,
      error: { message: err.message },
    })
    return
  }

  // ── Erreur inconnue / non gérée ────────────────────────────────────────────
  const unknown = err as Error

  errorLogger.log(
    'UNHANDLED_ERROR',
    {
      service: 'error-handler',
      requestId,
      actor,
      metadata: {
        message:  unknown?.message ?? 'Unknown error',
        method:   req.method,
        endpoint: req.originalUrl,
      },
    },
    unknown?.stack,
  )

  res.status(500).json({
    status: false,
    error: { message: 'Internal server error' },
  })
}