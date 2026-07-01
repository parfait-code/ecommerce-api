import { DiscountType } from "@prisma/client";

interface PromotionInfo {
  isActive: boolean;
  status: string;
  startDate: Date;
  endDate: Date;
}

interface DiscountWithRelations {
  id: string;
  promotionId: string;
  type: DiscountType;
  value: number;
  categoryId: string | null;
  promotion: PromotionInfo;
  products: { productId: number }[];
}

export interface PricingInfo {
  originalPrice: number;
  finalPrice: number;
  discountAmount: number;
  discountPercentage: number | null;
  hasDiscount: boolean;
  promotionId: string | null;
  discountId: string | null;
}

export const isPromotionActiveNow = (promotion: PromotionInfo): boolean => {
  const now = new Date();
  return (
    promotion.isActive &&
    promotion.status === "ACTIVE" &&
    promotion.startDate <= now &&
    promotion.endDate >= now
  );
};

const computePrice = (
  originalPrice: number,
  discount: { type: DiscountType; value: number },
): number => {
  if (discount.type === "PERCENTAGE") {
    return Math.round(originalPrice * (1 - discount.value / 100) * 100) / 100;
  }
  return Math.max(0, Math.round((originalPrice - discount.value) * 100) / 100);
};

/**
 * Retourne le meilleur prix (celui qui avantage le plus le client) parmi
 * toutes les remises actives applicables à ce produit (par catégorie ou par produit).
 * Ne cumule pas les remises entre elles.
 */
export const getBestPricing = (
  product: { id: number; price: number; categoryId: string },
  activeDiscounts: DiscountWithRelations[],
): PricingInfo => {
  const applicable = activeDiscounts.filter((d) => {
    if (!isPromotionActiveNow(d.promotion)) return false;
    const matchesCategory =
      d.categoryId !== null && d.categoryId === product.categoryId;
    const matchesProduct = d.products.some((p) => p.productId === product.id);
    return matchesCategory || matchesProduct;
  });

  if (applicable.length === 0) {
    return {
      originalPrice: product.price,
      finalPrice: product.price,
      discountAmount: 0,
      discountPercentage: null,
      hasDiscount: false,
      promotionId: null,
      discountId: null,
    };
  }

  let best = applicable[0];
  let bestPrice = computePrice(product.price, best);

  for (const d of applicable.slice(1)) {
    const candidatePrice = computePrice(product.price, d);
    if (candidatePrice < bestPrice) {
      best = d;
      bestPrice = candidatePrice;
    }
  }

  const discountAmount = Math.round((product.price - bestPrice) * 100) / 100;
  const discountPercentage =
    best.type === "PERCENTAGE"
      ? best.value
      : Math.round((discountAmount / product.price) * 100);

  return {
    originalPrice: product.price,
    finalPrice: bestPrice,
    discountAmount,
    discountPercentage,
    hasDiscount: true,
    promotionId: best.promotionId,
    discountId: best.id,
  };
};
