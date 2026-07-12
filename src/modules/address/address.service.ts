import { addressRepository } from "./address.repository";
import {
  ValidateAddressDto,
  CreateAddressDto,
  UpdateAddressDto,
} from "./address.schema";
import { AppError } from "../../shared/utils/app-error";
import { businessLogger } from "../../shared/logger";
import { normalizeCountry } from "../../shared/constants/countries";

const assertNormalizedCountry = (country: string): string => {
  const normalized = normalizeCountry(country);
  if (!normalized) {
    throw new AppError(
      `"${country}" is not a supported country. Use POST /address/validate to check supported values.`,
      400,
    );
  }
  return normalized;
};

export const addressService = {
  validate: (dto: ValidateAddressDto) => {
    const normalizedCountry = normalizeCountry(dto.country);
    const isValid =
      dto.street.length >= 2 &&
      dto.city.length >= 2 &&
      dto.country.length >= 2 &&
      normalizedCountry !== null;

    return {
      valid: isValid,
      normalized_address: isValid
        ? {
            recipientName: dto.recipientName.trim(),
            phone: dto.phone?.trim() ?? null,
            street: dto.street.trim(),
            addressLine2: dto.addressLine2?.trim() ?? null,
            city: dto.city.trim(),
            state: dto.state?.trim() ?? null,
            country: normalizedCountry,
            postalCode: dto.postalCode?.trim() ?? null,
          }
        : null,
    };
  },

  getAll: (userId: string) => addressRepository.findAllByUser(userId),

  getById: async (id: string, userId: string) => {
    const address = await addressRepository.findById(id);
    if (!address) throw new AppError("Address not found", 404);
    if (address.userId !== userId) throw new AppError("Forbidden", 403);
    return address;
  },

  create: async (userId: string, dto: CreateAddressDto) => {
    const normalizedCountry = assertNormalizedCountry(dto.country);

    if (dto.isDefault) await addressRepository.unsetDefault(userId);
    const address = await addressRepository.create(userId, {
      ...dto,
      country: normalizedCountry,
    });

    businessLogger.log("ADDRESS_CREATED", {
      service: "address",
      actor: { userId, role: "CUSTOMER" },
      target: { addressId: address.id, userId },
      metadata: {
        city: dto.city,
        country: normalizedCountry,
        isDefault: dto.isDefault,
      },
    });

    return address;
  },

  update: async (id: string, userId: string, dto: UpdateAddressDto) => {
    const address = await addressRepository.findById(id);
    if (!address) throw new AppError("Address not found", 404);
    if (address.userId !== userId) throw new AppError("Forbidden", 403);

    const normalizedCountry = dto.country
      ? assertNormalizedCountry(dto.country)
      : undefined;

    if (dto.isDefault) await addressRepository.unsetDefault(userId);

    const updated = await addressRepository.update(id, {
      ...dto,
      ...(normalizedCountry && { country: normalizedCountry }),
    });

    businessLogger.log("ADDRESS_UPDATED", {
      service: "address",
      actor: { userId, role: "CUSTOMER" },
      target: { addressId: id, userId },
      metadata: { fields: Object.keys(dto) },
    });

    return updated;
  },

  delete: async (id: string, userId: string) => {
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
