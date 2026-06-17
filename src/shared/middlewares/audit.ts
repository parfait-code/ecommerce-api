import { Request, Response, NextFunction } from 'express'
import { auditLogger } from '../logger'
import { AuditEvent } from '../logger'

/**
 * Mappe une combinaison méthode + pattern de route vers un AuditEvent.
 * Les patterns sont testés dans l'ordre — le premier qui matche gagne.
 */
const AUDIT_RULES: Array<{
  method: string
  pattern: RegExp
  event: AuditEvent
}> = [
  // Users
  { method: 'PATCH', pattern: /\/user\/change-role/,      event: 'ROLE_CHANGED'       },
  { method: 'DELETE', pattern: /\/user\//,                event: 'USER_DELETED'       },
  { method: 'PATCH',  pattern: /\/user$/,                 event: 'USER_UPDATED'       },

  // Products
  { method: 'POST',   pattern: /\/product$/,              event: 'PRODUCT_CREATED'    },
  { method: 'PATCH',  pattern: /\/product\//,             event: 'PRODUCT_UPDATED'    },
  { method: 'DELETE', pattern: /\/product\//,             event: 'PRODUCT_DELETED'    },

  // Orders
  { method: 'DELETE', pattern: /\/orders\//,              event: 'ORDER_CANCELLED'    },
  { method: 'PUT',    pattern: /\/orders\/.*\/status/,    event: 'ORDER_STATUS_CHANGED' },

  // Payments
  { method: 'POST',   pattern: /\/payments$/,             event: 'PAYMENT_APPROVED'   },

  // Inventory
  { method: 'POST',   pattern: /\/inventory\/transfer/,   event: 'STOCK_TRANSFERRED'  },
  { method: 'PUT',    pattern: /\/inventory\//,           event: 'STOCK_ADJUSTED'     },

  // Warehouses
  { method: 'DELETE', pattern: /\/warehouses\//,          event: 'STOCK_REMOVED'      },
]

/**
 * Audit Middleware (section 14)
 * S'accroche sur res.finish pour logger APRÈS que la réponse soit envoyée
 * — on connaît ainsi le statusCode réel.
 * Ne log que si la requête a réussi (2xx).
 */
export const auditMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const rule = AUDIT_RULES.find(
    (r) => r.method === req.method && r.pattern.test(req.path),
  )

  if (!rule) {
    next()
    return
  }

  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return

    const ctx = req.context

    auditLogger.log(rule.event, {
      service: 'audit',
      requestId: ctx?.requestId ?? req.id,
      actor: {
        userId:    ctx?.userId    ?? null,
        role:      ctx?.role      ?? 'ANONYMOUS',
        ip:        ctx?.ip        ?? 'unknown',
        userAgent: ctx?.userAgent ?? 'unknown',
      },
      target: resolveTarget(rule.event, req),
      metadata: {
        method:     req.method,
        endpoint:   req.originalUrl,
        statusCode: res.statusCode,
      },
    })
  })

  next()
}

/**
 * Extrait la cible (target) de la requête selon l'événement
 */
function resolveTarget(event: AuditEvent, req: Request) {
  switch (event) {
    case 'ROLE_CHANGED':
      return { userId: req.params.userId, metadata: req.body }
    case 'USER_DELETED':
      return { userId: req.params.userId }
    case 'PRODUCT_CREATED':
    case 'PRODUCT_UPDATED':
    case 'PRODUCT_DELETED':
      return { productId: req.params.productId }
    case 'ORDER_CANCELLED':
    case 'ORDER_STATUS_CHANGED':
      return { orderId: req.params.orderId }
    case 'PAYMENT_APPROVED':
      return { orderId: req.body?.order_id }
    case 'STOCK_TRANSFERRED':
      return { inventoryId: req.body?.item_id }
    case 'STOCK_ADJUSTED':
      return { inventoryId: req.params.item_id }
    default:
      return {}
  }
}