import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { authRepository } from './auth.repository'
import { SignupDto, LoginDto } from './auth.schema'
import { AppError } from '../../shared/utils/app-error'
import { env } from '../../shared/config/env'

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

    const { password: _, ...userWithoutPassword } = user
    return { user: userWithoutPassword, token }
  },

  login: async (dto: LoginDto) => {
    const user = await authRepository.findByUsername(dto.username)
    if (!user) throw new AppError(`Could not find any user with username: \`${dto.username}\`.`, 400)

    const valid = await bcrypt.compare(dto.password, user.password)
    if (!valid) throw new AppError('Provided username and password did not match.', 400)

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN },
    )

    const { password: _, ...userWithoutPassword } = user
    return { user: userWithoutPassword, token }
  },
}