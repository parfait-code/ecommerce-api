import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { env } from './env'

const adapter = new PrismaNeon({ connectionString: env.DATABASE_URL })

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter, log: ['error'] })

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma