import { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/app-error'

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: false,
      error: { message: err.message },
    })
  }
  console.error(err)
  return res.status(500).json({
    status: false,
    error: { message: 'Internal server error' },
  })
}