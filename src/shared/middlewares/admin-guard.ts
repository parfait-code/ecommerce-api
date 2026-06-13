import { Request, Response, NextFunction } from 'express'

export const adminGuard = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      status: false,
      error: { message: 'You need to be a admin to access this endpoint.' },
    })
  }
  next()
}