import { addressRepository } from './address.repository'
import { ValidateAddressDto, CreateAddressDto, UpdateAddressDto } from './address.schema'
import { AppError } from '../../shared/utils/app-error'

const VALID_COUNTRIES = [
  'CM', 'Cameroon', 'FR', 'France', 'US', 'United States',
  'GB', 'United Kingdom', 'SN', 'Senegal', 'CI', "Côte d'Ivoire",
  'NG', 'Nigeria', 'GH', 'Ghana',
]

export const addressService = {
  validate: (dto: ValidateAddressDto) => {
    const isValid =
      dto.street.length >= 2 &&
      dto.city.length >= 2 &&
      dto.country.length >= 2 &&
      dto.postal_code.length >= 2 &&
      VALID_COUNTRIES.some((c) => c.toLowerCase() === dto.country.toLowerCase())

    return {
      valid: isValid,
      normalized_address: isValid
        ? {
            street: dto.street.trim(),
            city: dto.city.trim(),
            state: dto.state?.trim() ?? null,
            country: dto.country.trim(),
            postal_code: dto.postal_code.trim(),
          }
        : null,
    }
  },

  getAll: (userId: number) =>
    addressRepository.findAllByUser(userId),

  getById: async (id: string, userId: number) => {
    const address = await addressRepository.findById(id)
    if (!address) throw new AppError('Address not found', 404)
    if (address.userId !== userId) throw new AppError('Forbidden', 403)
    return address
  },

  create: async (userId: number, dto: CreateAddressDto) => {
    if (dto.isDefault) await addressRepository.unsetDefault(userId)
    return addressRepository.create(userId, dto)
  },

  update: async (id: string, userId: number, dto: UpdateAddressDto) => {
    const address = await addressRepository.findById(id)
    if (!address) throw new AppError('Address not found', 404)
    if (address.userId !== userId) throw new AppError('Forbidden', 403)
    if (dto.isDefault) await addressRepository.unsetDefault(userId)
    return addressRepository.update(id, dto)
  },

  delete: async (id: string, userId: number) => {
    const address = await addressRepository.findById(id)
    if (!address) throw new AppError('Address not found', 404)
    if (address.userId !== userId) throw new AppError('Forbidden', 403)
    await addressRepository.delete(id)
    return { message: 'Address deleted successfully' }
  },
}