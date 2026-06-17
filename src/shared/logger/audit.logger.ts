import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import path from 'path'
import { LogEntry, AuditEvent } from './logger.types'

const { combine, timestamp, json, errors } = winston.format

/**
 * Audit Logger
 * Responsable : trail d'audit (ROLE_CHANGED, PRICE_CHANGED, etc.)
 * Destination : logs/audit/
 * Rétention   : 365 jours minimum (section 20)
 */
const _auditLogger = winston.createLogger({
  level: 'info',
  format: combine(
    timestamp(),
    errors({ stack: true }),
    json(),
  ),
  transports: [
    new DailyRotateFile({
      filename: path.join('logs', 'audit', 'audit-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '365d',
      zippedArchive: true,
      auditFile: path.join('logs', 'archive', 'audit-audit.json'),
    }),
  ],
})

/**
 * Méthode principale — respecte le schéma universel section 9
 */
export const auditLogger = {
  log: (event: AuditEvent, entry: Omit<LogEntry, 'event'>): void => {
    _auditLogger.info({
      service: entry.service,
      event,
      requestId: entry.requestId ?? null,
      actor: entry.actor ?? null,
      target: entry.target ?? null,
      metadata: entry.metadata ?? null,
    })
  },
}