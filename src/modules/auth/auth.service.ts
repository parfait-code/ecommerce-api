import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { authRepository } from './auth.repository'
import { SignupDto, LoginDto } from './auth.schema'
import { AppError } from '../../shared/utils/app-error'
import { env } from '../../shared/config/env'
import { businessLogger, securityLogger } from '../../shared/logger'

export const authService = {
  signup: async (dto: SignupDto) => {
    const existingUser = await authRepository.findByUsername(dto.username)
    if (existingUser) throw new AppError('Username already taken', 409)

    const existingEmail = await authRepository.findByEmail(dto.email)
    if (existingEmail) throw new AppError('Email already taken', 409)

    const password = await bcrypt.hash(dto.password, 10)
    const user = await authRepository.createUser({ ...dto, password })

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN },
    )

    businessLogger.log('USER_REGISTERED', {
      service: 'auth',
      actor: {
        userId: user.id,
        role:   'CUSTOMER',
      },
      target: { userId: user.id },
      metadata: {
        username: user.username,
        email:    user.email,
      },
    })

    const { password: _, ...userWithoutPassword } = user
    return { user: userWithoutPassword, token }
  },

  login: async (dto: LoginDto) => {
    const user = await authRepository.findByUsername(dto.username)

    if (!user) {
      securityLogger.log('FAILED_LOGIN', {
        service: 'auth',
        actor: { userId: null, role: 'ANONYMOUS' },
        metadata: { username: dto.username, reason: 'User not found' },
      })
      throw new AppError(`Could not find any user with username: \`${dto.username}\`.`, 400)
    }

    const valid = await bcrypt.compare(dto.password, user.password)

    if (!valid) {
      securityLogger.log('FAILED_LOGIN', {
        service: 'auth',
        actor: { userId: user.id, role: 'CUSTOMER' },
        metadata: { username: dto.username, reason: 'Wrong password' },
      })
      throw new AppError('Provided username and password did not match.', 400)
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN },
    )

    businessLogger.log('USER_LOGIN', {
      service: 'auth',
      actor: {
        userId: user.id,
        role:   user.role === 'admin' ? 'ADMIN' : 'CUSTOMER',
      },
      target: { userId: user.id },
      metadata: { username: user.username },
    })

    const { password: _, ...userWithoutPassword } = user
    return { user: userWithoutPassword, token }
  },
}