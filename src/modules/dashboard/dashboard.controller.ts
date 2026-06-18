import { Request, Response, NextFunction } from 'express'
import { dashboardService } from './dashboard.service'
import { respond } from '../../shared/utils/response'

export const dashboardController = {
  getStats: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await dashboardService.getStats()
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },

  getSalesChart: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await dashboardService.getSalesChart(req.query as Record<string, string>)
      respond(res, result)
    } catch (err) {
      next(err)
    }
  },
}