import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { errorHandler }    from './shared/middlewares/error-handler'
import { morganMiddleware } from './shared/middlewares/morgan'
import { requestId }       from './shared/middlewares/request-id'
import { requestContext }  from './shared/middlewares/request-context'
import { auditMiddleware } from './shared/middlewares/audit'
import { securityLogger }  from './shared/logger'
import authRouter          from './modules/auth/auth.router'
import userRouter          from './modules/users/user.router'
import productRouter       from './modules/products/product.router'
import basketRouter        from './modules/basket/basket.router'
import orderRouter         from './modules/orders/order.router'
import checkoutRouter      from './modules/checkout/checkout.router'
import paymentRouter       from './modules/payments/payment.router'
import reviewRouter        from './modules/reviews/review.router'
import warehouseRouter     from './modules/warehouses/warehouse.router'
import inventoryRouter     from './modules/inventory/inventory.router'
import shipmentRouter      from './modules/shipments/shipment.router'
import addressRouter       from './modules/address/address.router'
import dashboardRouter from './modules/dashboard/dashboard.router'

const app = express()

// ── Sécurité de base ──────────────────────────────────────────────────────────
app.use(helmet())
app.use(cors())

// ── Rate Limiting global (section 16 — RATE_LIMIT_EXCEEDED) ──────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    securityLogger.log('RATE_LIMIT_EXCEEDED', {
      service: 'rate-limiter',
      requestId: req.id,
      actor: {
        userId:    req.context?.userId    ?? null,
        role:      req.context?.role      ?? 'ANONYMOUS',
        ip:        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
                   ?? req.socket.remoteAddress
                   ?? 'unknown',
        userAgent: req.headers['user-agent'] ?? 'unknown',
      },
      metadata: {
        method:   req.method,
        endpoint: req.originalUrl,
      },
    })
    res.status(429).json({
      status: false,
      error: { message: 'Too many requests, please try again later.' },
    })
  },
})

app.use(limiter)

// ── Corrélation & contexte (doit précéder morgan et les routes) ───────────────
app.use(requestId)
app.use(express.json())
app.use(morganMiddleware)
app.use(requestContext)

// ── Audit automatique des routes sensibles ────────────────────────────────────
app.use(auditMiddleware)

// ── Routeurs ──────────────────────────────────────────────────────────────────
app.use(authRouter)
app.use(userRouter)
app.use(productRouter)
app.use(basketRouter)
app.use(orderRouter)
app.use(checkoutRouter)
app.use(paymentRouter)
app.use(reviewRouter)
app.use(warehouseRouter)
app.use(inventoryRouter)
app.use(shipmentRouter)
app.use(addressRouter)
app.use(dashboardRouter)

// ── Gestion d'erreurs (doit être le dernier middleware) ───────────────────────
app.use(errorHandler)

export default app