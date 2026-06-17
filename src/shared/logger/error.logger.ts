import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import path from 'path'
import { LogEntry, ErrorEvent } from './logger.types'

const { combine, timestamp, json, errors } = winston.format

/**
 * Error Logger
 * Responsable : DATABASE_ERROR, PAYMENT_PROVIDER_ERROR, UNHANDLED_ERROR, etc.
 * Destination : logs/errors/
 * Rétention   : 90 jours (section 20)
 */
const _errorLogger = winston.createLogger({
  level: 'error',
  format: combine(
    timestamp(),
    errors({ stack: true }),
    json(),
  ),
  transports: [
    new DailyRotateFile({
      filename: path.join('logs', 'errors', 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '90d',
      zippedArchive: true,
      auditFile: path.join('logs', 'archive', 'error-audit.json'),
    }),
  ],
})

/**
 * Méthode principale — respecte le schéma universel section 9
 * Le stack trace est passé dans metadata pour ne pas polluer la structure
 */
export const errorLogger = {
  log: (
    event: ErrorEvent,
    entry: Omit<LogEntry, 'event'>,
    stack?: string,
  ): void => {
    _errorLogger.error({
      service: entry.service,
      event,
      requestId: entry.requestId ?? null,
      actor: entry.actor ?? null,
      target: entry.target ?? null,
      metadata: {
        ...entry.metadata,
        ...(stack ? { stack } : {}),
      },
    })
  },
}