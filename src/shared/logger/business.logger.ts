import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import path from 'path'
import { LogEntry, BusinessEvent } from './logger.types'

const { combine, timestamp, json, errors } = winston.format

/**
 * Business Logger
 * Responsable : logs métier (ORDER_CREATED, PAYMENT_SUCCESS, etc.)
 * Destination : logs/business/
 * Rétention   : 180 jours (section 20)
 */
const _businessLogger = winston.createLogger({
  level: 'info',
  format: combine(
    timestamp(),
    errors({ stack: true }),
    json(),
  ),
  transports: [
    new DailyRotateFile({
      filename: path.join('logs', 'business', 'business-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '180d',
      zippedArchive: true,
      auditFile: path.join('logs', 'archive', 'business-audit.json'),
    }),
  ],
})

/**
 * Méthode principale — respecte le schéma universel section 9
 */
export const businessLogger = {
  log: (event: BusinessEvent, entry: Omit<LogEntry, 'event'>): void => {
    _businessLogger.info({
      service: entry.service,
      event,
      requestId: entry.requestId ?? null,
      actor: entry.actor ?? null,
      target: entry.target ?? null,
      metadata: entry.metadata ?? null,
    })
  },
}