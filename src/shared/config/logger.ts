import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import path from 'path'

const { combine, timestamp, json, colorize, printf, errors } = winston.format

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
}

const level = () => {
  const env = process.env.NODE_ENV ?? 'development'
  return env === 'production' ? 'info' : 'debug'
}

const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
  return `${timestamp} [${level}]: ${stack ?? message}${metaStr}`
})

const fileTransport = (filename: string, lvl: string) =>
  new DailyRotateFile({
    filename: path.join('logs', `${filename}-%DATE%.log`),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    level: lvl,
    format: combine(timestamp(), errors({ stack: true }), json()),
  })

export const logger = winston.createLogger({
  level: level(),
  levels,
  format: combine(timestamp(), errors({ stack: true }), json()),
  transports: [
    fileTransport('error', 'error'),
    fileTransport('combined', 'http'),
  ],
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join('logs', 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
    }),
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join('logs', 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
    }),
  ],
})

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: 'HH:mm:ss' }),
        errors({ stack: true }),
        consoleFormat,
      ),
    }),
  )
}

winston.addColors({
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
})