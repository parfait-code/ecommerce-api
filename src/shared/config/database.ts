import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { systemLogger } from '../logger'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

const createPrismaClient = () => {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
  return new PrismaClient({
    adapter,
    log: [
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

prisma.$on('error', (e) => {
  systemLogger.error('DATABASE_ERROR', {
    service: 'database',
    metadata: { message: e.message },
  })
})

prisma.$on('warn', (e) => {
  systemLogger.log('DATABASE_CONNECTED', {
    service: 'database',
    metadata: { warning: e.message },
  })
})