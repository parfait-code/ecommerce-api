import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import path from 'path'

const { combine, timestamp, json, errors } = winston.format

/**
 * Access Logger
 * Responsable : logs HTTP (Morgan stream)
 * Destination : logs/access/
 * Rétention   : 30 jours (section 20)
 */
export const accessLogger = winston.createLogger({
  level: 'http',
  format: combine(
    timestamp(),
    errors({ stack: true }),
    json(),
  ),
  transports: [
    new DailyRotateFile({
      filename: path.join('logs', 'access', 'access-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true,
      auditFile: path.join('logs', 'archive', 'access-audit.json'),
    }),
  ],
})