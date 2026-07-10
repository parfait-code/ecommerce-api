import { addressRepository } from "./address.repository";
import {
  ValidateAddressDto,
  CreateAddressDto,
  UpdateAddressDto,
} from "./address.schema";
import { AppError } from "../../shared/utils/app-error";
import { businessLogger } from "../../shared/logger";

const VALID_COUNTRIES = [
  "CM",
  "Cameroon",
  "FR",
  "France",
  "US",
  "United States",
  "GB",
  "United Kingdom",
  "SN",
  "Senegal",
  "CI",
  "Côte d'Ivoire",
  "NG",
  "Nigeria",
  "GH",
  "Ghana",
];

const isValidCountry = (country: string): boolean =>
  VALID_COUNTRIES.some((c) => c.toLowerCase() === country.toLowerCase());

const assertValidCountry = (country: string): void => {
  if (!isValidCountry(country)) {
    throw new AppError(
      `"${country}" is not a supported country. Use POST /address/validate to check supported values.`,
      400,
    );
  }
};

export const addressService = {
  validate: (dto: ValidateAddressDto) => {
    const isValid =
      dto.street.length >= 2 &&
      dto.city.length >= 2 &&
      dto.country.length >= 2 &&
      dto.postalCode.length >= 2 &&
      isValidCountry(dto.country);

    return {
      valid: isValid,
      normalized_address: isValid
        ? {
            street: dto.street.trim(),
            city: dto.city.trim(),
            state: dto.state?.trim() ?? null,
            country: dto.country.trim(),
            postalCode: dto.postalCode.trim(),
          }
        : null,
    };
  },

  getAll: (userId: number) => addressRepository.findAllByUser(userId),

  getById: async (id: string, userId: number) => {
    const address = await addressRepository.findById(id);
    if (!address) throw new AppError("Address not found", 404);
    if (address.userId !== userId) throw new AppError("Forbidden", 403);
    return address;
  },

  create: async (userId: number, dto: CreateAddressDto) => {
    assertValidCountry(dto.country);

    if (dto.isDefault) await addressRepository.unsetDefault(userId);
    const address = await addressRepository.create(userId, dto);

    businessLogger.log("ADDRESS_CREATED", {
      service: "address",
      actor: { userId, role: "CUSTOMER" },
      target: { addressId: address.id, userId },
      metadata: {
        city: dto.city,
        country: dto.country,
        isDefault: dto.isDefault,
      },
    });

    return address;
  },

  update: async (id: string, userId: number, dto: UpdateAddressDto) => {
    const address = await addressRepository.findById(id);
    if (!address) throw new AppError("Address not found", 404);
    if (address.userId !== userId) throw new AppError("Forbidden", 403);

    if (dto.country) assertValidCountry(dto.country);

    if (dto.isDefault) await addressRepository.unsetDefault(userId);

    const updated = await addressRepository.update(id, dto);

    businessLogger.log("ADDRESS_UPDATED", {
      service: "address",
      actor: { userId, role: "CUSTOMER" },
      target: { addressId: id, userId },
      metadata: { fields: Object.keys(dto) },
    });

    return updated;
  },

  delete: async (id: string, userId: number) => {
    const address = await addressRepository.findById(id);
    if (!address) throw new AppError("Address not found", 404);
    if (address.userId !== userId) throw new AppError("Forbidden", 403);

    await addressRepository.delete(id);

    businessLogger.log("ADDRESS_DELETED", {
      service: "address",
      actor: { userId, role: "CUSTOMER" },
      target: { addressId: id, userId },
    });

    return { message: "Address deleted successfully" };
  },
};
