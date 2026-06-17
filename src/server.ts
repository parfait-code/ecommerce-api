import 'dotenv/config'
import app from './app'
import { env } from './shared/config/env'
import { systemLogger } from './shared/logger'

const server = app.listen(env.PORT, () => {
  systemLogger.log('SERVER_STARTED', {
    service: 'server',
    metadata: {
      port: env.PORT,
      env:  env.NODE_ENV,
    },
  })
})

/**
 * Graceful shutdown — log SERVER_STOPPED avant de quitter
 * Couvre SIGTERM (Docker stop) et SIGINT (Ctrl+C)
 */
const shutdown = (signal: string) => {
  systemLogger.log('SERVER_STOPPED', {
    service: 'server',
    metadata: { signal },
  })
  server.close(() => process.exit(0))
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))