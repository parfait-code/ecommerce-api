import { popupRepository } from "./popup.repository";
import { promotionRepository } from "../promotions/promotion.repository";
import { categoryRepository } from "../categories/category.repository";
import { productRepository } from "../products/product.repository";
import { CreatePopupDto, UpdatePopupDto } from "./popup.schema";
import { AppError } from "../../shared/utils/app-error";
import { businessLogger } from "../../shared/logger";
import {
  uploadImage as uploadR2Image,
  deleteImage as deleteR2Image,
} from "../../shared/utils/upload";

interface ResolvableTarget {
  targetType: string;
  targetId: string | null;
  externalUrl: string | null;
}

// Règle canonique unique de construction d'URL — le frontend n'a plus à la
// dupliquer (carousel, popup, cartes de recherche...), il consomme resolvedUrl.
const resolveUrl = async (popup: ResolvableTarget): Promise<string | null> => {
  switch (popup.targetType) {
    case "PROMOTION": {
      if (!popup.targetId) return null;
      const promotion = await promotionRepository.findById(popup.targetId);
      return promotion ? `/promotions/${promotion.slug}` : null;
    }
    case "CATEGORY": {
      if (!popup.targetId) return null;
      const category = await categoryRepository.findById(popup.targetId, true);
      return category ? `/categories/${category.slug}` : null;
    }
    case "PRODUCT": {
      if (!popup.targetId) return null;
      const product = await productRepository.findById(popup.targetId, true);
      return product ? `/products/${product.id}` : null;
    }
    case "EXTERNAL_LINK":
      return popup.externalUrl ?? null;
    case "INFO":
    default:
      return null;
  }
};

const withResolvedUrl = async <T extends ResolvableTarget>(popup: T) => ({
  ...popup,
  resolvedUrl: await resolveUrl(popup),
});

export const popupService = {
  getAll: (query: { isActive?: string; targetType?: string }) =>
    popupRepository.findAll(query),

  getActive: async () => {
    const popups = await popupRepository.findActiveNow();
    return Promise.all(popups.map(withResolvedUrl));
  },

  getById: async (id: string) => {
    const popup = await popupRepository.findById(id);
    if (!popup) throw new AppError("Popup not found", 404);
    return withResolvedUrl(popup);
  },

  create: async (dto: CreatePopupDto) => {
    const popup = await popupRepository.create(dto);

    businessLogger.log("POPUP_CREATED", {
      service: "popups",
      actor: { userId: null, role: "ADMIN" },
      target: { popupId: popup.id },
      metadata: { title: popup.title, targetType: popup.targetType },
    });

    return withResolvedUrl(popup);
  },

  update: async (id: string, dto: UpdatePopupDto) => {
    const popup = await popupRepository.findById(id);
    if (!popup) throw new AppError("Popup not found", 404);

    const updated = await popupRepository.update(id, dto);

    businessLogger.log("POPUP_UPDATED", {
      service: "popups",
      actor: { userId: null, role: "ADMIN" },
      target: { popupId: id },
      metadata: { fields: Object.keys(dto) },
    });

    return withResolvedUrl(updated);
  },

  delete: async (id: string) => {
    const popup = await popupRepository.findById(id);
    if (!popup) throw new AppError("Popup not found", 404);

    await popupRepository.delete(id);

    businessLogger.log("POPUP_DELETED", {
      service: "popups",
      actor: { userId: null, role: "ADMIN" },
      target: { popupId: id },
      metadata: { title: popup.title },
    });

    return { message: "Popup deleted successfully" };
  },

  // ── Upload / suppression de l'image (Cloudflare R2) ───────────────────
  // Aligné sur categories/products/promotions : l'API uploade elle-même
  // le fichier et stocke l'URL publique générée dans `imageUrl`.
  uploadImage: async (id: string, file: Express.Multer.File) => {
    const popup = await popupRepository.findById(id);
    if (!popup) throw new AppError("Popup not found", 404);

    const newImageUrl = await uploadR2Image(file, "popups");
    if (popup.imageUrl) await deleteR2Image(popup.imageUrl);

    const updated = await popupRepository.update(id, {
      imageUrl: newImageUrl,
    } as any);

    businessLogger.log("POPUP_UPDATED", {
      service: "popups",
      actor: { userId: null, role: "ADMIN" },
      target: { popupId: id },
      metadata: { fields: ["imageUrl"] },
    });

    return withResolvedUrl(updated);
  },

  deleteImage: async (id: string) => {
    const popup = await popupRepository.findById(id);
    if (!popup) throw new AppError("Popup not found", 404);
    if (!popup.imageUrl) throw new AppError("No image set on this popup", 404);

    await deleteR2Image(popup.imageUrl);
    const updated = await popupRepository.update(id, {
      imageUrl: null,
    } as any);

    businessLogger.log("POPUP_UPDATED", {
      service: "popups",
      actor: { userId: null, role: "ADMIN" },
      target: { popupId: id },
      metadata: { fields: ["imageUrl"] },
    });

    return withResolvedUrl(updated);
  },
};
