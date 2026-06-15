import morgan, { StreamOptions } from 'morgan'
import { logger } from '../config/logger'
import { env } from '../config/env'

const stream: StreamOptions = {
  write: (message: string) =>
    logger.http(message.trim(), { type: 'http' }),
}

const skip = () => env.NODE_ENV === 'test'

const morganFormat = env.NODE_ENV === 'production' ? 'combined' : 'dev'

export const morganMiddleware = morgan(morganFormat, { stream, skip })