# CHANGELOG — Route publique promotions actives

## Contexte

Demande frontend (`addEndpoint.md`) : aucune route publique ne permettait de
découvrir les promotions actuellement actives (storefront home/bannière).
`GET /promotions` est réservée ADMIN, `GET /promotions/slug/:slug` nécessite
de déjà connaître le slug.

## Ajout — `GET /promotions/active`

| Route | Auth | Retour |
|---|---|---|
| `GET /promotions/active` | ❌ Publique | `Promotion[]` (statut calculé `ACTIVE`, triées par `endDate` croissante) |

**Fichiers modifiés :**

| Fichier | Modification |
|---|---|
| `src/modules/promotions/promotion.service.ts` | Ajout de `getActive()` |
| `src/modules/promotions/promotion.controller.ts` | Ajout de `getActive()` |
| `src/modules/promotions/promotion.router.ts` | Ajout de la route `GET /promotions/active` |

## Détails d'implémentation

- Réutilise `promotionRepository.findAll({ isActive: "true" })` — aucune
  nouvelle requête Prisma, aucun accès Prisma ajouté hors repository.
- Filtre sur le **statut calculé** (`computeDisplayStatus`), jamais sur le
  champ `status` stocké en base — cohérent avec `getAll`/`getById`/`getBySlug`.
- Tri par `endDate` croissante (les promotions qui expirent bientôt en premier).
- Forme de réponse identique à `GET /promotions/slug/:slug` (même
  `promotionInclude` : `discounts`, `coupons`, `_count`) — pas de mapping
  supplémentaire nécessaire côté frontend.
- Pas de mise en cache Redis ajoutée — cohérent avec `getAll`/`getById` qui
  ne cachent pas non plus les promotions (contrairement à `products`/`categories`).

## Point d'attention routing

⚠️ La route `GET /promotions/active` est déclarée **avant**
`GET /promotions/:promotionId` dans le router — obligatoire en Express pour
éviter qu'`active` soit capturé comme valeur de `:promotionId`.

## Documentation à mettre à jour (non fait dans ce lot)

- `API_ROUTES.MD` §18 — ajouter la ligne de route.
- `API_INTEGRATION_GUIDE.md` §19 — ajouter l'appel dans le tableau des actions.

## Décisions non prises (hors scope)

- Pas de pagination sur `/promotions/active` — le volume de promotions
  simultanément actives est supposé faible ; à revoir si ce n'est plus le cas.
- Pas de cache Redis — décision à confirmer si le trafic homepage le justifie.