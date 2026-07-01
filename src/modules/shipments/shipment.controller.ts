import { Request, Response, NextFunction } from "express";
import { shipmentService } from "./shipment.service";
import { respond } from "../../shared/utils/response";

export const shipmentController = {
  calculateCost: (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = shipmentService.calculateCost(req.body);
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await shipmentService.create(req.body);
      respond(res, result, 201);
    } catch (err) {
      next(err);
    }
  },

  getAll: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await shipmentService.getAll(
        req.query as Record<string, string>,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await shipmentService.getById(
        req.params.shipmentId as string,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  addTrackingEvent: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await shipmentService.addTrackingEvent(
        req.params.shipmentId as string,
        req.body,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getTracking: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await shipmentService.getTracking(
        req.params.shipmentId as string,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  cancel: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await shipmentService.cancel(
        req.params.shipmentId as string,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getLabel: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await shipmentService.getLabel(
        req.params.shipmentId as string,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  createPickupRequest: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await shipmentService.createPickupRequest(
        req.user!.userId,
        req.body,
      );
      respond(res, result, 201);
    } catch (err) {
      next(err);
    }
  },

  getAllPickupRequests: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await shipmentService.getAllPickupRequests(
        req.query as Record<string, string>,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  getPickupRequest: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await shipmentService.getPickupRequest(
        req.params.requestId as string,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },

  cancelPickupRequest: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await shipmentService.cancelPickupRequest(
        req.params.requestId as string,
        req.user!.userId,
      );
      respond(res, result);
    } catch (err) {
      next(err);
    }
  },
};
