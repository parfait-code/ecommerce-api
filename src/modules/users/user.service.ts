import { userRepository } from './user.repository'
import { UpdateUserDto, ChangeRoleDto } from './user.schema'
import { AppError } from '../../shared/utils/app-error'

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
    return strip(updated as Record<string, unknown>)
  },

  getAllUsers: async () => {
    const users = await userRepository.findAll()
    return users.map((u) => strip(u as Record<string, unknown>))
  },

  changeRole: async (userId: number, dto: ChangeRoleDto) => {
    const user = await userRepository.findById(userId)
    if (!user) throw new AppError('User not found', 404)
    const updated = await userRepository.changeRole(userId, dto.role)
    return strip(updated as Record<string, unknown>)
  },

  deleteUser: async (userId: number) => {
    const user = await userRepository.findById(userId)
    if (!user) throw new AppError('User not found', 404)
    await userRepository.delete(userId)
    return { numberOfUsersDeleted: 1 }
  },
}