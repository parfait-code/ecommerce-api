import { userRepository } from './user.repository'
import { UpdateUserDto, ChangeRoleDto } from './user.schema'
import { AppError } from '../../shared/utils/app-error'
import { businessLogger, auditLogger } from '../../shared/logger'

const strip = (user: Record<string, unknown>) => {
  const { password: _, ...rest } = user
  return rest
}

export const userService = {
  getProfile: async (userId: number) => {
    const user = await userRepository.findById(userId)
    if (!user) throw new AppError('User not found', 404)
    return strip(user as Record<string, unknown>)
  },

  updateProfile: async (userId: number, dto: UpdateUserDto) => {
    const user = await userRepository.findById(userId)
    if (!user) throw new AppError('User not found', 404)
    const updated = await userRepository.update(userId, dto)

    businessLogger.log('USER_UPDATED', {
      service: 'users',
      actor:   { userId, role: 'CUSTOMER' },
      target:  { userId },
      metadata: { fields: Object.keys(dto) },
    })

    return strip(updated as Record<string, unknown>)
  },

  getAllUsers: async () => {
    const users = await userRepository.findAll()
    return users.map((u) => strip(u as Record<string, unknown>))
  },

  changeRole: async (userId: number, dto: ChangeRoleDto) => {
    const user = await userRepository.findById(userId)
    if (!user) throw new AppError('User not found', 404)

    const oldRole = user.role
    const updated = await userRepository.changeRole(userId, dto.role)

    businessLogger.log('ROLE_CHANGED', {
      service: 'users',
      actor:   { userId, role: 'ADMIN' },
      target:  { userId },
      metadata: { oldRole, newRole: dto.role },
    })

    auditLogger.log('ROLE_CHANGED', {
      service: 'users',
      actor:   { userId, role: 'ADMIN' },
      target:  { userId },
      metadata: { oldRole, newRole: dto.role },
    })

    return strip(updated as Record<string, unknown>)
  },

  deleteUser: async (userId: number) => {
    const user = await userRepository.findById(userId)
    if (!user) throw new AppError('User not found', 404)
    await userRepository.delete(userId)

    businessLogger.log('USER_DELETED', {
      service: 'users',
      actor:   { userId, role: 'ADMIN' },
      target:  { userId },
      metadata: { username: user.username },
    })

    auditLogger.log('USER_DELETED', {
      service: 'users',
      actor:   { userId, role: 'ADMIN' },
      target:  { userId },
      metadata: { username: user.username },
    })

    return { numberOfUsersDeleted: 1 }
  },
}