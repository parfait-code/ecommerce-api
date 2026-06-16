import { addressService } from '../../src/modules/address/address.service'
import { addressRepository } from '../../src/modules/address/address.repository'
import { AppError } from '../../src/shared/utils/app-error'

jest.mock('../../src/modules/address/address.repository')

const mockAddressRepository = addressRepository as jest.Mocked<typeof addressRepository>

const mockAddress = {
  id: 'address-cuid-1',
  userId: 1,
  street: '123 Rue Principale',
  city: 'Yaoundé',
  state: null,
  country: 'Cameroon',
  postalCode: '00000',
  isDefault: false,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('AddressService', () => {
  describe('validate', () => {
    it('should return valid for a supported country', () => {
      const result = addressService.validate({
        street: '123 Rue Principale',
        city: 'Yaoundé',
        country: 'Cameroon',
        postal_code: '00000',
      })

      expect(result.valid).toBe(true)
      expect(result.normalized_address).not.toBeNull()
      expect(result.normalized_address?.country).toBe('Cameroon')
    })

    it('should return valid for country code (CM)', () => {
      const result = addressService.validate({
        street: '123 Rue Principale',
        city: 'Yaoundé',
        country: 'CM',
        postal_code: '00000',
      })

      expect(result.valid).toBe(true)
    })

    it('should be case-insensitive for country', () => {
      const result = addressService.validate({
        street: '123 Rue Principale',
        city: 'Yaoundé',
        country: 'cameroon',
        postal_code: '00000',
      })

      expect(result.valid).toBe(true)
    })

    it('should return invalid for an unsupported country', () => {
      const result = addressService.validate({
        street: '123 Main St',
        city: 'Tokyo',
        country: 'Japan',
        postal_code: '100-0001',
      })

      expect(result.valid).toBe(false)
      expect(result.normalized_address).toBeNull()
    })

    it('should trim whitespace from fields in normalized address', () => {
      const result = addressService.validate({
        street: '  123 Rue Principale  ',
        city: '  Yaoundé  ',
        country: 'CM',
        postal_code: '  00000  ',
      })

      expect(result.valid).toBe(true)
      expect(result.normalized_address?.street).toBe('123 Rue Principale')
      expect(result.normalized_address?.city).toBe('Yaoundé')
      expect(result.normalized_address?.postal_code).toBe('00000')
    })

    it('should include state in normalized address if provided', () => {
      const result = addressService.validate({
        street: '123 Main St',
        city: 'Paris',
        state: 'Île-de-France',
        country: 'France',
        postal_code: '75001',
      })

      expect(result.valid).toBe(true)
      expect(result.normalized_address?.state).toBe('Île-de-France')
    })

    it('should return null state if not provided', () => {
      const result = addressService.validate({
        street: '123 Rue Principale',
        city: 'Yaoundé',
        country: 'CM',
        postal_code: '00000',
      })

      expect(result.normalized_address?.state).toBeNull()
    })
  })

  describe('getAll', () => {
    it('should return all addresses for a user', async () => {
      mockAddressRepository.findAllByUser.mockResolvedValue([mockAddress])

      const result = await addressService.getAll(1)

      expect(mockAddressRepository.findAllByUser).toHaveBeenCalledWith(1)
      expect(result).toHaveLength(1)
    })
  })

  describe('getById', () => {
    it('should return address if found and owned by user', async () => {
      mockAddressRepository.findById.mockResolvedValue(mockAddress)

      const result = await addressService.getById('address-cuid-1', 1)

      expect(result).toEqual(mockAddress)
    })

    it('should throw 404 if address not found', async () => {
      mockAddressRepository.findById.mockResolvedValue(null)

      await expect(addressService.getById('nonexistent', 1)).rejects.toThrow(
        new AppError('Address not found', 404),
      )
    })

    it('should throw 403 if address belongs to another user', async () => {
      mockAddressRepository.findById.mockResolvedValue(mockAddress) // userId: 1

      await expect(addressService.getById('address-cuid-1', 99)).rejects.toThrow(
        new AppError('Forbidden', 403),
      )
    })
  })

  describe('create', () => {
    it('should create an address', async () => {
      mockAddressRepository.create.mockResolvedValue(mockAddress)

      const result = await addressService.create(1, {
        street: '123 Rue Principale',
        city: 'Yaoundé',
        country: 'Cameroon',
        postalCode: '00000',
        isDefault: false,
      })

      expect(mockAddressRepository.create).toHaveBeenCalled()
      expect(result).toEqual(mockAddress)
    })

    it('should unset other default addresses before creating a default one', async () => {
      mockAddressRepository.unsetDefault.mockResolvedValue({ count: 1 })
      mockAddressRepository.create.mockResolvedValue({ ...mockAddress, isDefault: true })

      await addressService.create(1, {
        street: '123 Rue Principale',
        city: 'Yaoundé',
        country: 'Cameroon',
        postalCode: '00000',
        isDefault: true,
      })

      expect(mockAddressRepository.unsetDefault).toHaveBeenCalledWith(1)
    })

    it('should not call unsetDefault if address is not default', async () => {
      mockAddressRepository.create.mockResolvedValue(mockAddress)

      await addressService.create(1, {
        street: '123 Rue Principale',
        city: 'Yaoundé',
        country: 'Cameroon',
        postalCode: '00000',
        isDefault: false,
      })

      expect(mockAddressRepository.unsetDefault).not.toHaveBeenCalled()
    })
  })

  describe('update', () => {
    it('should update an address', async () => {
      const updated = { ...mockAddress, city: 'Douala' }
      mockAddressRepository.findById.mockResolvedValue(mockAddress)
      mockAddressRepository.update.mockResolvedValue(updated)

      const result = await addressService.update('address-cuid-1', 1, { city: 'Douala' })

      expect(result.city).toBe('Douala')
    })

    it('should unset other defaults when updating to default', async () => {
      mockAddressRepository.findById.mockResolvedValue(mockAddress)
      mockAddressRepository.unsetDefault.mockResolvedValue({ count: 1 })
      mockAddressRepository.update.mockResolvedValue({ ...mockAddress, isDefault: true })

      await addressService.update('address-cuid-1', 1, { isDefault: true })

      expect(mockAddressRepository.unsetDefault).toHaveBeenCalledWith(1)
    })

    it('should throw 404 if address not found', async () => {
      mockAddressRepository.findById.mockResolvedValue(null)

      await expect(
        addressService.update('nonexistent', 1, { city: 'Douala' }),
      ).rejects.toThrow(new AppError('Address not found', 404))
    })

    it('should throw 403 if address belongs to another user', async () => {
      mockAddressRepository.findById.mockResolvedValue(mockAddress) // userId: 1

      await expect(
        addressService.update('address-cuid-1', 99, { city: 'Douala' }),
      ).rejects.toThrow(new AppError('Forbidden', 403))
    })
  })

  describe('delete', () => {
    it('should delete an address and return message', async () => {
      mockAddressRepository.findById.mockResolvedValue(mockAddress)
      mockAddressRepository.delete.mockResolvedValue(mockAddress)

      const result = await addressService.delete('address-cuid-1', 1)

      expect(mockAddressRepository.delete).toHaveBeenCalledWith('address-cuid-1')
      expect(result).toEqual({ message: 'Address deleted successfully' })
    })

    it('should throw 404 if address not found', async () => {
      mockAddressRepository.findById.mockResolvedValue(null)

      await expect(addressService.delete('nonexistent', 1)).rejects.toThrow(
        new AppError('Address not found', 404),
      )
    })

    it('should throw 403 if address belongs to another user', async () => {
      mockAddressRepository.findById.mockResolvedValue(mockAddress) // userId: 1

      await expect(addressService.delete('address-cuid-1', 99)).rejects.toThrow(
        new AppError('Forbidden', 403),
      )
    })
  })
})