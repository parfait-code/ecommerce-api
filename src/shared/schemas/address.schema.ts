import { z } from "zod";

/**
 * Forme canonique d'une adresse, partagée entre le module `address` et
 * `order.schema.ts` (shippingAddress/billingAddress). Avant ce fichier,
 * les deux modules redéfinissaient la même notion avec des règles
 * différentes (cf. audit) — c'est désormais l'unique source de vérité.
 *
 * `postalCode` est optionnel : certains pays (ex: Cameroun) n'ont pas de
 * code postal résidentiel généralisé. Pas de règle par-pays pour l'instant
 * (table de correspondance pays→obligatoire non implémentée — complexité
 * jugée disproportionnée pour l'instant, à revisiter si besoin réel).
 */
export const addressFieldsSchema = z.object({
  recipientName: z.string().min(2).max(100),
  phone: z.string().optional(),
  street: z.string().min(2),
  addressLine2: z.string().optional(),
  city: z.string().min(2),
  state: z.string().optional(),
  country: z.string().min(2),
  postalCode: z.string().min(2).optional(),
});

export type AddressFieldsDto = z.infer<typeof addressFieldsSchema>;
