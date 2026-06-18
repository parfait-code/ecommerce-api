import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { systemLogger } from '../logger'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

const createPrismaClient = () => {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })

  const client = new PrismaClient({
    adapter,
    log: [
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn'  },
    ],
  })

  // Cast explicite nécessaire car les surcharges de $on sont perdues
  // quand PrismaClient est instancié avec un adapter custom
  ;(client as any).$on('error', (e: { message: string }) => {
    systemLogger.error('DATABASE_ERROR', {
      service:  'database',
      metadata: { message: e.message },
    })
  })

  ;(client as any).$on('warn', (e: { message: string }) => {
    systemLogger.log('DATABASE_CONNECTED', {
      service:  'database',
      metadata: { warning: e.message },
    })
  })

  return client
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma