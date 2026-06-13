import { prisma } from '../../shared/config/database'
import { UpdateUserDto } from './user.schema'

export const userRepository = {
  findById: (id: number) =>
    prisma.user.findUnique({ where: { id } }),

  findAll: () =>
    prisma.user.findMany(),

  update: (id: number, data: UpdateUserDto) =>
    prisma.user.update({ where: { id }, data }),

  changeRole: (id: number, role: string) =>
    prisma.user.update({ where: { id }, data: { role } }),

  delete: (id: number) =>
    prisma.user.delete({ where: { id } }),
}