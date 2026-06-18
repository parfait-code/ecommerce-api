import { Request, Response, NextFunction } from 'express'
import { auditLogger, Target, AuditEvent } from '../logger'

const AUDIT_RULES: Array<{
  method: string
  pattern: RegExp
  event: AuditEvent
}> = [
  // Users
  { method: 'PATCH',  pattern: /\/user\/change-role/, event: 'ROLE_CHANGED'         },
  { method: 'DELETE', pattern: /\/user\//,             event: 'USER_DELETED'         },
  { method: 'PATCH',  pattern: /\/user$/,              event: 'USER_UPDATED'         },

  // Products
  { method: 'POST',   pattern: /\/product$/,           event: 'PRODUCT_CREATED'      },
  { method: 'PATCH',  pattern: /\/product\//,          event: 'PRODUCT_UPDATED'      },
  { method: 'DELETE', pattern: /\/product\//,          event: 'PRODUCT_DELETED'      },

  // Orders
  { method: 'DELETE', pattern: /\/orders\//,           event: 'ORDER_CANCELLED'      },
  { method: 'PUT',    pattern: /\/orders\/.*\/status/, event: 'ORDER_STATUS_CHANGED' },

  // Payments
  { method: 'POST',   pattern: /\/payments$/,          event: 'PAYMENT_APPROVED'     },

  // Inventory
  { method: 'POST',   pattern: /\/inventory\/transfer/,event: 'STOCK_TRANSFERRED'    },
  { method: 'PUT',    pattern: /\/inventory\//,        event: 'STOCK_ADJUSTED'       },

  // Warehouses
  { method: 'DELETE', pattern: /\/warehouses\//,       event: 'STOCK_REMOVED'        },
]

/**
 * Résout un paramètre de route en string | undefined.
 * Express type req.params[key] comme string | string[] en accès dynamique,
 * ce helper force la résolution correcte.
 */
function param(req: Request, key: string): string | undefined {
  const value = req.params[key]
  if (Array.isArray(value)) return value[0]
  return value
}

/**
 * Audit Middleware (section 14)
 * S'accroche sur res.finish pour logger APRÈS que la réponse soit envoyée.
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
      service:   'audit',
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
 * Extrait la cible (target) de la requête selon l'événement.
 * Utilise le helper param() pour garantir string | undefined.
 */
function resolveTarget(event: AuditEvent, req: Request): Target {
  switch (event) {
    case 'ROLE_CHANGED':
    case 'USER_DELETED':
    case 'USER_UPDATED':
      return { userId: param(req, 'userId') }

    case 'PRODUCT_CREATED':
    case 'PRODUCT_UPDATED':
    case 'PRODUCT_DELETED':
      return { productId: param(req, 'productId') }

    case 'ORDER_CANCELLED':
    case 'ORDER_STATUS_CHANGED':
      return { orderId: param(req, 'orderId') }

    case 'PAYMENT_APPROVED':
      return { orderId: req.body?.order_id as string | undefined }

    case 'STOCK_TRANSFERRED':
      return { inventoryId: req.body?.item_id as string | undefined }

    case 'STOCK_ADJUSTED':
      return { inventoryId: param(req, 'item_id') }

    case 'STOCK_REMOVED':
      return { warehouseId: param(req, 'warehouse_id') }

    default:
      return {}
  }
}