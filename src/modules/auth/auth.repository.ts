import { prisma } from '../../shared/config/database'

export const authRepository = {
  findByUsername: (username: string) =>
    prisma.user.findUnique({ where: { username } }),

  findByEmail: (email: string) =>
    prisma.user.findUnique({ where: { email } }),

  createUser: (data: {
    username: string
    email: string
    password: string
    firstName: string
    lastName: string
    age: number
    role: string
  }) => prisma.user.create({ data }),
}