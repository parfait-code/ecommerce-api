import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import path from 'path'
import { LogEntry, SecurityEvent } from './logger.types'

const { combine, timestamp, json, errors } = winston.format

/**
 * Security Logger
 * Responsable : FAILED_LOGIN, INVALID_JWT, FORBIDDEN_ACCESS, etc.
 * Destination : logs/security/
 * Rétention   : 180 jours (section 20)
 */
const _securityLogger = winston.createLogger({
  level: 'warn',
  format: combine(
    timestamp(),
    errors({ stack: true }),
    json(),
  ),
  transports: [
    new DailyRotateFile({
      filename: path.join('logs', 'security', 'security-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '180d',
      zippedArchive: true,
      auditFile: path.join('logs', 'archive', 'security-audit.json'),
    }),
  ],
})

/**
 * Méthode principale — respecte le schéma universel section 9
 */
export const securityLogger = {
  log: (event: SecurityEvent, entry: Omit<LogEntry, 'event'>): void => {
    _securityLogger.warn({
      service: entry.service,
      event,
      requestId: entry.requestId ?? null,
      actor: entry.actor ?? null,
      target: entry.target ?? null,
      metadata: entry.metadata ?? null,
    })
  },
}