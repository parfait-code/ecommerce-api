# CONVENTIONS — Conventions du projet

## Langue

| Contexte                                       | Langue   |
| ---------------------------------------------- | -------- |
| Code (variables, fonctions, classes, fichiers) | Anglais  |
| Commentaires dans le code                      | Anglais  |
| Documentation projet (ces fichiers .md)        | Français |
| Messages d'erreur API (valeur `message`)       | Anglais  |
| Commits Git                                    | Anglais  |

---

## Nommage

### Fichiers et dossiers

```
kebab-case pour tout
src/modules/shipping-methods/
src/shared/middlewares/auth-guard.ts
```

### Dans le code TypeScript

```ts
// Variables et fonctions → camelCase
const accessToken = ...
async function getUserById(id: number) {}

// Classes et types → PascalCase
class UserService {}
type CreateProductDto = { ... }
interface OrderRepository { ... }

// Constantes → SCREAMING_SNAKE_CASE
const JWT_EXPIRES_IN = 3600
const LOW_STOCK_THRESHOLD = 10

// Enums → PascalCase + valeurs SCREAMING_SNAKE_CASE
enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}
```

### Routes Express

```
kebab-case, pluriel pour les ressources
/users, /products, /payment-methods, /shipping-methods
/orders/:orderId/status
/pickup-requests/:requestId/cancel
```

### Terminologie métier — ne pas dévier

| Concept | Terme imposé | À ne jamais utiliser |
|---|---|---|
| Panier | `basket` | `cart` |
| Variante produit | `combination` / `combinationId` | `variant` / `variantId` (ancien système, retiré) |
| Étape avant commande | (inexistant — la commande se crée directement depuis le panier ou une liste d'items) | `checkout` en tant que module dédié |

---

## Structure d'un module

```
src/modules/<nom>/
├── <nom>.router.ts        # routes uniquement, pas de logique
├── <nom>.controller.ts    # extrait req/res, appelle le service, renvoie la réponse
├── <nom>.service.ts       # logique métier pure, pas de req/res
├── <nom>.repository.ts    # accès Prisma uniquement
├── <nom>.schema.ts        # schémas Zod pour validation
└── <nom>.state-machine.ts # optionnel — transitions de statut valides (order, payment)
```

**Règle stricte** : un fichier ne fait qu'une chose. Le controller ne contient pas de requêtes Prisma. Le service ne contient pas de `req` ou `res`. Le repository ne contient pas de règle métier (validation, calcul de prix, etc.).

---

## Gestion des erreurs

### Classe d'erreur métier

```ts
// src/shared/utils/app-error.ts
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
  ) {
    super(message);
  }
}
```

### Middleware global d'erreur

```ts
// src/shared/middlewares/error-handler.ts
// Distingue AppError (401→securityLogger, 403→securityLogger, autres→errorLogger)
// des erreurs non gérées (→ errorLogger UNHANDLED_ERROR, toujours 500 générique côté client).
```

### Usage dans les services

```ts
// Lancer une erreur métier
throw new AppError("User not found", 404);
throw new AppError("Invalid credentials", 400);
```

**Ne jamais** laisser fuiter un message d'erreur technique (stack trace, message Prisma brut) dans la réponse HTTP — toujours passer par `AppError` avec un message métier clair.

---

## Format des réponses HTTP

Toujours utiliser l'helper `respond` :

```ts
// src/shared/utils/response.ts
export const respond = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ status: true, data });
```

```ts
// Dans un controller
respond(res, { user, token }); // 200
respond(res, createdProduct, 201); // 201
```

---

## Validation avec Zod

```ts
// product.schema.ts
import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(2).max(200),
  price: z.number().positive(),
  categoryId: z.string(),
  weight: z.number().positive(),
});

export type CreateProductDto = z.infer<typeof createProductSchema>;
```

```ts
// middleware de validation
// src/shared/middlewares/validate.ts
export const validate = (schema: ZodSchema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      status: false,
      error: { message: "Validation failed", details: result.error.flatten() },
    });
  }
  req.body = result.data;
  next();
};
```

**Convention pour les schémas de mise à jour** : dériver systématiquement du schéma de création via `.partial()`, en excluant explicitement les champs immuables via `.omit()` (ex : `categoryId` sur un produit).

---

## Authentification et autorisation

```ts
// Guard JWT
// src/shared/middlewares/auth-guard.ts
// Vérifie le Bearer token, attache req.user = { userId, username, role }
// Log UNAUTHORIZED_ACCESS / INVALID_JWT / TOKEN_TAMPERING selon le cas d'échec.

// Guard admin
// src/shared/middlewares/admin-guard.ts
// Vérifie req.user.role === 'ADMIN', sinon 403 + log FORBIDDEN_ACCESS.
// Doit toujours être utilisé APRÈS authGuard.
```

```ts
// Usage dans un router
router.get("/user/all", authGuard, adminGuard, userController.getAllUsers);
router.patch("/user", authGuard, validate(updateUserSchema), userController.updateProfile);
```

**Convention pour les routes de lecture publiques du catalogue** : toute ressource consultable sur le storefront sans compte (produits, catégories actives, attributs, combinaisons actives, tags, avis, promotions actives) doit être accessible **sans** `authGuard`. Ne protéger par `authGuard`/`adminGuard` que les routes d'écriture ou les vues explicitement réservées à un rôle (ex : consultation admin d'une ressource inactive/soft-deleted).

---

## Pagination

Toutes les routes de liste acceptent :

```
GET /products?page=1&limit=20
```

Helper standard :

```ts
// src/shared/utils/pagination.ts
export const paginate = (query: { page?: string; limit?: string }) => ({
  skip: (Number(query.page ?? 1) - 1) * Number(query.limit ?? 20),
  take: Number(query.limit ?? 20),
})

// Réponse paginée
{
  "status": true,
  "data": {
    "items": [...],
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

---

## Upload de fichiers (Cloudflare R2)

Pattern unique appliqué à toute ressource ayant une image (produits, promotions, catégories) :

1. Le champ fichier passe par le middleware `multer` (`src/shared/middlewares/multer.ts`), en mémoire (`multer.memoryStorage()`), avec une limite de 5MB et un filtre MIME (`jpeg/png/webp/gif`).
2. Le controller extrait `req.file`/`req.files` et appelle le service — **jamais** de logique d'upload dans le controller.
3. Le service délègue à `uploadImage(file, folder)` (`src/shared/utils/upload.ts`), qui génère une clé unique (`crypto.randomUUID()`), envoie le buffer sur R2 via `PutObjectCommand`, et renvoie l'URL publique construite à partir de `R2_PUBLIC_URL`.
4. Toute suppression d'image passe par `deleteImage(url)`, qui reconstruit la clé à partir de l'URL et envoie un `DeleteObjectCommand` — jamais de suppression silencieuse d'un ancien fichier orphelin sans passer par cette fonction.

**Convention de nommage des dossiers R2** : un sous-dossier par ressource (`products/`, `promotions/`, `categories/`, `categories/icons/`), jamais à la racine du bucket.

**Ne jamais** accepter une route qui prend une URL d'image en `multipart` uniquement — toujours permettre en complément un champ `imageUrl`/`iconUrl` texte simple validé en `.url()` pour les cas où le frontend a déjà une URL externe (migration de données, import).

---

## Event Bus (découplage inter-modules)

Toute règle de synchronisation entre domaines (ex : "commande livrée → crédite les points fidélité") passe par le bus d'événements interne (`src/shared/events`), jamais par un import direct entre deux `*.service.ts` de modules différents.

```ts
// Émettre un événement — les services métier importent UNIQUEMENT
// event-bus.ts et event-types.ts, jamais events/index.ts (cycle d'import).
import { eventBus } from "../../shared/events/event-bus";

eventBus.emit("order.status.changed", { orderId, userId, fromStatus, toStatus, totalAmount });
```

```ts
// Écouter un événement — un fichier par domaine réactif dans listeners/,
// enregistré une seule fois dans src/shared/events/index.ts, importé
// uniquement depuis src/app.ts.
export const registerInventoryEventListeners = (): void => {
  eventBus.on("inventory.quantity.changed", async (payload) => { /* ... */ });
};
```

**Règle d'or** : aucune erreur de listener n'est jamais avalée silencieusement — le bus capture systématiquement les erreurs et les logue (`EVENT_LISTENER_FAILED`), et chaque listener applicatif est encouragé à ajouter son propre contexte métier via `ORDER_SYNC_FAILED` ou équivalent. Voir `src/shared/events/README.md` et `STATUS_MANAGEMENT.md` pour le détail complet.

---

## Machines à états (state-machine)

Toute entité dont les transitions de statut doivent être strictement contrôlées (pas de saut arbitraire d'un état à un autre) définit sa table de transitions dans un fichier dédié `<nom>.state-machine.ts`, exportant une fonction `assertValidTransition(from, to)` qui lève une `AppError(400)` si la transition n'est pas autorisée.

```ts
// order.state-machine.ts / payment.state-machine.ts
const TRANSITIONS: Record<Status, Status[]> = { /* ... */ };

export const assertValidTransition = (from: Status, to: Status): void => {
  if (from === to) return;
  if (!TRANSITIONS[from].includes(to)) {
    throw new AppError(`Invalid transition: ${from} -> ${to}`, 400);
  }
};
```

Actuellement implémenté pour `Order` et `Payment`. Les entités à statut plus simples (`ReturnRequest`, `Shipment`, `PickupRequest`) utilisent des garde-fous ad hoc directement dans le service plutôt qu'une state machine dédiée — voir `STATUS_MANAGEMENT.md` pour le détail par entité.

---

## Commits Git

Format : `<type>(<scope>): <description>`

| Type       | Usage                                       |
| ---------- | ------------------------------------------- |
| `feat`     | Nouvelle fonctionnalité                     |
| `fix`      | Correction de bug                           |
| `refactor` | Refactoring sans changement de comportement |
| `test`     | Ajout ou modification de tests              |
| `docs`     | Documentation uniquement                    |
| `chore`    | Config, dépendances, CI                     |
| `perf`     | Amélioration de performance                 |

```
feat(categories): add image/icon upload endpoint aligned with products
fix(catalog): make categories and combinations routes public for guests
fix(orders): return 404 when order not found
refactor(products): extract price logic to service
test(basket): add integration tests for add-product
chore(docker): update postgres to 16-alpine
```

---

## Variables d'environnement

- Toujours définir dans `.env.example` avant d'utiliser.
- Jamais de valeur par défaut sensible en production dans le code.
- Accès centralisé via `src/shared/config/env.ts` (validation Zod stricte — l'application refuse de démarrer si une variable requise manque ou est invalide).

```ts
// src/shared/config/env.ts
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string(),
  MIGRATE_DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.coerce.number().default(3600),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_PRODUCTS: z.string().default("products"),
  R2_BUCKET_INVOICES: z.string().default("invoices"),
  R2_ENDPOINT: z.string().optional(),
  R2_PUBLIC_URL: z.string().url().optional(),
});

export const env = envSchema.parse(process.env);
```

Voir `ARCHITECTURE.md` (section "Variables d'environnement") pour la liste complète avec description de chaque variable.

---

## Tests

- Tests unitaires : logique service isolée (mock du repository via `jest.mock(...)`).
- Tests d'intégration : routes complètes via `supertest`, connexion réelle à la base de test et à Redis, nettoyage explicite dans `afterAll` (voir `tests/integration/setup/db.ts`).
- Nommage : `<nom>.test.ts` dans `tests/unit/` ou `tests/integration/`.
- Couverture minimale cible : 70% sur les services (`collectCoverageFrom: ['src/modules/**/*.service.ts']` dans `jest.config.Js`).
- Utiliser les factories partagées (`tests/mocks/factories.ts`) plutôt que de recréer des objets de test à la main dans chaque fichier.

```ts
// Convention de test
describe('ProductService', () => {
  describe('createProduct', () => {
    it('should create a product with valid data', async () => { ... })
    it('should throw if name is empty', async () => { ... })
  })
})
```

---

## Ce qu'on n'utilise PAS dans ce projet

- Pas de `any` TypeScript — utiliser `unknown` si le type est incertain.
- Pas de `console.log` en production — utiliser le logger (Winston, via `src/shared/logger`).
- Pas de logique métier dans les controllers.
- Pas de requêtes Prisma directes dans les controllers ou services — passer par les repositories.
- Pas de `DELETE` quand la suppression est logique — utiliser un champ `status`/`isActive`, ou un `POST /cancel`.
- Pas d'import direct entre deux `*.service.ts` de modules différents pour une synchronisation de statut — passer par l'event bus (`src/shared/events`).
- Pas de module "checkout" séparé — la création de commande se fait directement via `POST /orders`.
- Pas de "cart" ni de "variant" dans le code ou les noms de route — voir "Terminologie métier" plus haut.

## Commande pour les migrations Prisma

```bash
npx prisma migrate resolve --applied 20260613_add_shipments
npx prisma generate
```

## Commande pour réinitialiser la base de données (dev/test)

```bash
npx prisma migrate reset
# ou, sans confirmation interactive :
npx prisma migrate reset --force
```

⚠️ Aucun `seed` n'est configuré dans `prisma.config.ts` — la base est vide après reset. Recréer un admin ensuite avec `npm run seed:admin`.
```