import morgan, { StreamOptions } from 'morgan'
import { accessLogger } from '../logger'
import { env } from '../config/env'

/**
 * Stream Morgan → accessLogger
 * Chaque ligne HTTP est écrite dans logs/access/
 * Le requestId est injecté dans le token custom :req-id
 */
morgan.token('req-id', (req: any) => req.id ?? '-')
morgan.token('user-id', (req: any) => req.context?.userId?.toString() ?? '-')
morgan.token('role', (req: any) => req.context?.role ?? '-')

const stream: StreamOptions = {
  write: (message: string) => {
    accessLogger.http(message.trim())
  },
}

/**
 * Format étendu : inclut requestId, userId, role pour corrélation (section 7 & 8)
 * Désactivé en test pour ne pas polluer les sorties Jest
 */
const skip = (): boolean => env.NODE_ENV === 'test'

const extendedFormat =
  ':req-id :user-id [:role] :method :url :status :res[content-length] - :response-time ms'

const morganFormat =
  env.NODE_ENV === 'production' ? extendedFormat : 'dev'

export const morganMiddleware = morgan(morganFormat, { stream, skip })