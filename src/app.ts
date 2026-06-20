import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { errorHandler } from "./shared/middlewares/error-handler";
import { morganMiddleware } from "./shared/middlewares/morgan";
import { requestId } from "./shared/middlewares/request-id";
import { requestContext } from "./shared/middlewares/request-context";
import { auditMiddleware } from "./shared/middlewares/audit";
import { securityLogger } from "./shared/logger";
import authRouter from "./modules/auth/auth.router";
import userRouter from "./modules/users/user.router";
import productRouter from "./modules/products/product.router";
import basketRouter from "./modules/basket/basket.router";
import orderRouter from "./modules/orders/order.router";
import paymentRouter from "./modules/payments/payment.router";
import reviewRouter from "./modules/reviews/review.router";
import warehouseRouter from "./modules/warehouses/warehouse.router";
import inventoryRouter from "./modules/inventory/inventory.router";
import shipmentRouter from "./modules/shipments/shipment.router";
import addressRouter from "./modules/address/address.router";
import dashboardRouter from "./modules/dashboard/dashboard.router";
import categoryRouter from "./modules/categories/category.router";
import promotionRouter from "./modules/promotions/promotion.router";
import attributeRouter from "./modules/attributes/attribute.router";
import variantRouter from "./modules/variants/variant.router";
import tagRouter from "./modules/tags/tag.router";
import shippingMethodRouter from "./modules/shipping-methods/shipping-method.router";
import loyaltyRouter from "./modules/loyalty/loyalty.router";

const app = express();

app.use(helmet());
app.use(cors());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    securityLogger.log("RATE_LIMIT_EXCEEDED", {
      service: "rate-limiter",
      requestId: req.id,
      actor: {
        userId: req.context?.userId ?? null,
        role: req.context?.role ?? "ANONYMOUS",
        ip:
          (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
          req.socket.remoteAddress ??
          "unknown",
        userAgent: req.headers["user-agent"] ?? "unknown",
      },
      metadata: { method: req.method, endpoint: req.originalUrl },
    });
    res.status(429).json({
      status: false,
      error: { message: "Too many requests, please try again later." },
    });
  },
});

app.use(limiter);
app.use(requestId);
app.use(express.json());
app.use(morganMiddleware);
app.use(requestContext);
app.use(auditMiddleware);

app.use(authRouter);
app.use(userRouter);
app.use(productRouter);
app.use("/product/:productId/variants", variantRouter);
app.use(basketRouter);
app.use(orderRouter);
app.use(paymentRouter);
app.use(reviewRouter);
app.use(warehouseRouter);
app.use(inventoryRouter);
app.use(shipmentRouter);
app.use(addressRouter);
app.use(dashboardRouter);
app.use(categoryRouter);
app.use(promotionRouter);
app.use(attributeRouter);
app.use(tagRouter);
app.use(shippingMethodRouter);
app.use(loyaltyRouter);

app.use(errorHandler);

export default app;
