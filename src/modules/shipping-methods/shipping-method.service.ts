import { shippingMethodRepository } from "./shipping-method.repository";
import {
  CreateShippingMethodDto,
  UpdateShippingMethodDto,
  CalculateShippingDto,
} from "./shipping-method.schema";
import { AppError } from "../../shared/utils/app-error";
import { normalizeCountry } from "../../shared/constants/countries";

export const shippingMethodService = {
  getAll: (includeInactive = false) =>
    shippingMethodRepository.findAll(!includeInactive),

  getById: async (id: string, includeInactive = false) => {
    const method = await shippingMethodRepository.findById(id);
    if (!method) throw new AppError("Shipping method not found", 404);
    if (!includeInactive && !method.isActive)
      throw new AppError("Shipping method not found", 404);
    return method;
  },

  create: (dto: CreateShippingMethodDto) =>
    shippingMethodRepository.create(dto),

  update: async (id: string, dto: UpdateShippingMethodDto) => {
    const method = await shippingMethodRepository.findById(id);
    if (!method) throw new AppError("Shipping method not found", 404);
    return shippingMethodRepository.update(id, dto);
  },

  delete: async (id: string) => {
    const method = await shippingMethodRepository.findById(id);
    if (!method) throw new AppError("Shipping method not found", 404);
    await shippingMethodRepository.delete(id);
    return { message: "Shipping method deleted successfully" };
  },

  calculate: async (dto: CalculateShippingDto) => {
    const method = await shippingMethodRepository.findById(
      dto.shippingMethodId,
    );
    if (!method) throw new AppError("Shipping method not found", 404);
    if (!method.isActive)
      throw new AppError("Shipping method is not available", 400);

    // Nouveau — rapprochement Address.country ↔ zones, absent jusqu'ici
    // (cf. audit : "calculate() ignore totalement zones").
    const normalizedCountry = normalizeCountry(dto.country);
    if (!normalizedCountry)
      throw new AppError(`"${dto.country}" is not a supported country`, 400);
    if (!method.zones.includes(normalizedCountry))
      throw new AppError(
        `Shipping method "${method.name}" does not deliver to ${normalizedCountry}`,
        400,
      );

    const cost =
      Math.round((method.basePrice + method.pricePerKg * dto.weight) * 100) /
      100;
    return {
      shippingMethodId: method.id,
      name: method.name,
      estimatedDays: method.estimatedDays,
      cost,
      currency: "XAF",
    };
  },
};
