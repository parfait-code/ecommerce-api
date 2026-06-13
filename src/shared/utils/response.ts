import { Response } from 'express'

export const respond = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ status: true, data })