import { eventBus } from "../event-bus";
import { attributeRepository } from "../../../modules/attributes/attribute.repository";
import { combinationRepository } from "../../../modules/combinations/combination.repository";
import { systemLogger } from "../../logger";

/**
 * S4 — décision assumée : avertissement NON bloquant, journalisé.
 * Le guide laisse le choix entre "400 bloquant" et "warning" (§8.1, S4).
 * On choisit le warning car :
 * 1) c'est cohérent avec le principe fire-and-forget de l'event bus
 *    (une validation bloquante devrait se faire de façon synchrone dans
 *    product.service.ts, pas via un événement émis après coup) ;
 * 2) bloquer l'activation casserait potentiellement des workflows existants
 *    où un produit "variantisé" est activé avant que ses combinaisons
 *    n'aient été générées (ex: activation puis génération dans la même
 *    session admin).
 * Si un blocage strict est finalement voulu, le contrôle doit être ajouté
 * de façon synchrone dans product.service.ts::update(), avant l'appel à
 * productRepository.update() — pas ici.
 */
export const registerProductEventListeners = (): void => {
  eventBus.on("product.activated", async (payload) => {
    const definitions = await attributeRepository.findAllByCategory(
      payload.categoryId,
    );
    const hasVariantAttributes = definitions.some((d) => d.isVariant);
    if (!hasVariantAttributes) return;

    const combinations = await combinationRepository.findByProduct(
      payload.productId,
    );
    const hasActiveCombination = combinations.some((c) => c.isActive);

    if (!hasActiveCombination) {
      systemLogger.log("PRODUCT_ACTIVATED_WITHOUT_COMBINATIONS", {
        service: "product-listeners",
        metadata: {
          productId: payload.productId,
          categoryId: payload.categoryId,
          reason:
            "Product has variant attributes but no active combination exists yet",
        },
      });
    }
  });
};
