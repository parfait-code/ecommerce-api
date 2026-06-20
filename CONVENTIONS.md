# CONVENTIONS.md — Conventions du projet

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
src/modules/product-catalog/
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
const MAX_RETRY_ATTEMPTS = 3

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
/users, /products, /payment-methods
/orders/:orderId/status
/pickup-requests/:requestId/cancel
```

---

## Structure d'un module

```
src/modules/<nom>/
├── <nom>.router.ts       # routes uniquement, pas de logique
├── <nom>.controller.ts   # extrait req/res, appelle le service, renvoie la réponse
├── <nom>.service.ts      # logique métier pure, pas de req/res
├── <nom>.repository.ts   # accès Prisma uniquement
├── <nom>.schema.ts       # schémas Zod pour validation
└── <nom>.types.ts        # types et DTOs locaux
```

**Règle stricte** : un fichier ne fait qu'une chose. Le controller ne contient pas de requêtes Prisma. Le service ne contient pas de `req` ou `res`.

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
app.use((err, req, res, next) => {
  const status = err.statusCode ?? 500;
  res.status(status).json({
    status: false,
    error: { message: err.message ?? "Internal server error" },
  });
});
```

### Usage dans les services

```ts
// Lancer une erreur métier
throw new AppError("User not found", 404);
throw new AppError("Invalid credentials", 400);
```

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
  category: z.string(),
  stock: z.number().int().min(0).default(0),
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

---

## Authentification et autorisation

```ts
// Guard JWT
// src/shared/middlewares/auth-guard.ts
// Vérifie le Bearer token, attache req.user = { userId, username, role }

// Guard admin
// src/shared/middlewares/admin-guard.ts
// Vérifie req.user.role === 'admin', sinon 403
```

```ts
// Usage dans un router
router.get("/user/all", authGuard, adminGuard, getAllUsers);
router.patch("/user", authGuard, validate(updateUserSchema), updateUser);
```

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
feat(auth): add JWT refresh token endpoint
fix(orders): return 404 when order not found
refactor(products): extract price logic to service
test(basket): add integration tests for add-product
chore(docker): update postgres to 16-alpine
```

---

## Variables d'environnement

- Toujours définir dans `.env.example` avant d'utiliser
- Jamais de valeur par défaut en production dans le code
- Accès centralisé via `src/shared/config/env.ts`

```ts
// src/shared/config/env.ts
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.coerce.number().default(3600),
});

export const env = envSchema.parse(process.env);
```

---

## Tests

- Tests unitaires : logique service isolée (mock du repository)
- Tests d'intégration : routes complètes avec base de données de test
- Nommage : `<nom>.test.ts` dans `tests/unit/` ou `tests/integration/`
- Couverture minimale cible : 70% sur les services

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

- Pas de `any` TypeScript — utiliser `unknown` si le type est incertain
- Pas de `console.log` en production — utiliser le logger (Winston ou Pino)
- Pas de logique métier dans les controllers
- Pas de requêtes Prisma directes dans les controllers ou services — passer par les repositories
- Pas de `DELETE` quand la suppression est logique — utiliser un champ `status` ou un `POST /cancel`

## Commande pour les migrations Prisma

npx prisma migrate resolve --applied 20260613_add_shipments
npx prisma generate
