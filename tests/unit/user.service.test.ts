import { userService } from '../../src/modules/users/user.service'
import { userRepository } from '../../src/modules/users/user.repository'
import { AppError } from '../../src/shared/utils/app-error'

jest.mock('../../src/modules/users/user.repository')

const mockUserRepository = userRepository as jest.Mocked<typeof userRepository>

const mockUser = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  password: 'hashed',
  firstName: 'Test',
  lastName: 'User',
  age: 25,
  role: 'user',
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('UserService', () => {
  describe('getProfile', () => {
    it('should return user without password', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser)
      const result = await userService.getProfile(1)
      expect(result).not.toHaveProperty('password')
      expect(result).toHaveProperty('username', 'testuser')
    })

    it('should throw 404 if user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null)
      await expect(userService.getProfile(999)).rejects.toThrow(
        new AppError('User not found', 404),
      )
    })
  })

  describe('deleteUser', () => {
    it('should delete user and return count', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser)
      mockUserRepository.delete.mockResolvedValue(mockUser)
      const result = await userService.deleteUser(1)
      expect(result).toEqual({ numberOfUsersDeleted: 1 })
    })

    it('should throw 404 if user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null)
      await expect(userService.deleteUser(999)).rejects.toThrow(
        new AppError('User not found', 404),
      )
    })
  })

  describe('changeRole', () => {
    it('should change user role', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser)
      mockUserRepository.changeRole.mockResolvedValue({ ...mockUser, role: 'admin' })
      const result = await userService.changeRole(1, { role: 'admin' })
      expect(result).not.toHaveProperty('password')
    })
  })
})