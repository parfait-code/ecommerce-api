import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import path from 'path'
import { LogEntry, SystemEvent } from './logger.types'

const { combine, timestamp, json, errors, colorize, printf } = winston.format

const consoleFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
  return `${ts} [${level}]: ${message}${metaStr}`
})

/**
 * System Logger
 * Responsable : SERVER_STARTED, DATABASE_CONNECTED, REDIS_CONNECTED, etc.
 * Destination : logs/system/
 * Console     : toujours visible (dev JSON coloré, prod JSON pur)
 * Rétention   : 90 jours
 */
const _systemLogger = winston.createLogger({
  level: 'info',
  format: combine(
    timestamp(),
    errors({ stack: true }),
    json(),
  ),
  transports: [
    new DailyRotateFile({
      filename: path.join('logs', 'system', 'system-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '90d',
      zippedArchive: true,
      auditFile: path.join('logs', 'archive', 'system-audit.json'),
    }),
    // Console toujours active — JSON en prod, coloré en dev
    process.env.NODE_ENV === 'production'
      ? new winston.transports.Console({
          format: combine(timestamp(), json()),
        })
      : new winston.transports.Console({
          format: combine(
            colorize({ all: true }),
            timestamp({ format: 'HH:mm:ss' }),
            consoleFormat,
          ),
        }),
  ],
})

/**
 * Méthode principale — respecte le schéma universel section 9
 */
export const systemLogger = {
  log: (event: SystemEvent, entry: Omit<LogEntry, 'event'>): void => {
    _systemLogger.info({
      service: entry.service,
      event,
      requestId: entry.requestId ?? null,
      metadata: entry.metadata ?? null,
    })
  },

  error: (event: SystemEvent, entry: Omit<LogEntry, 'event'>): void => {
    _systemLogger.error({
      service: entry.service,
      event,
      requestId: entry.requestId ?? null,
      metadata: entry.metadata ?? null,
    })
  },
}