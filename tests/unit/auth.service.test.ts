import { authService } from '../../src/modules/auth/auth.service'
import { authRepository } from '../../src/modules/auth/auth.repository'
import { AppError } from '../../src/shared/utils/app-error'

jest.mock('../../src/modules/auth/auth.repository')

const mockAuthRepository = authRepository as jest.Mocked<typeof authRepository>

describe('AuthService', () => {
  describe('signup', () => {
    const dto = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      age: 25,
      role: 'user' as const,
    }

    it('should create a user and return token', async () => {
      mockAuthRepository.findByUsername.mockResolvedValue(null)
      mockAuthRepository.findByEmail.mockResolvedValue(null)
      mockAuthRepository.createUser.mockResolvedValue({
        id: 1,
        ...dto,
        password: 'hashed',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await authService.signup(dto)

      expect(result).toHaveProperty('token')
      expect(result).toHaveProperty('user')
      expect(result.user).not.toHaveProperty('password')
    })

    it('should throw 409 if username already taken', async () => {
      mockAuthRepository.findByUsername.mockResolvedValue({
        id: 1,
        ...dto,
        password: 'hashed',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await expect(authService.signup(dto)).rejects.toThrow(
        new AppError('Username already taken', 409),
      )
    })

    it('should throw 409 if email already taken', async () => {
      mockAuthRepository.findByUsername.mockResolvedValue(null)
      mockAuthRepository.findByEmail.mockResolvedValue({
        id: 1,
        ...dto,
        password: 'hashed',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await expect(authService.signup(dto)).rejects.toThrow(
        new AppError('Email already taken', 409),
      )
    })
  })

  describe('login', () => {
    it('should throw 400 if username not found', async () => {
      mockAuthRepository.findByUsername.mockResolvedValue(null)

      await expect(
        authService.login({ username: 'unknown', password: 'pass' }),
      ).rejects.toThrow(AppError)
    })

    it('should throw 400 if password does not match', async () => {
      mockAuthRepository.findByUsername.mockResolvedValue({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        password: 'wronghash',
        firstName: 'Test',
        lastName: 'User',
        age: 25,
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await expect(
        authService.login({ username: 'testuser', password: 'wrongpassword' }),
      ).rejects.toThrow(new AppError('Provided username and password did not match.', 400))
    })
  })
})