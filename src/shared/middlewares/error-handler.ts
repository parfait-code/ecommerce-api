import { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/app-error'
import { logger } from '../config/logger'

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof AppError) {
    logger.warn(err.message, { statusCode: err.statusCode })
    return res.status(err.statusCode).json({
      status: false,
      error: { message: err.message },
    })
  }
  logger.error('Unexpected error', { error: err })
  return res.status(500).json({
    status: false,
    error: { message: 'Internal server error' },
  })
}