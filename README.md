# E-Commerce API — Furniture Store

API backend pour une boutique en ligne de mobilier (furniture e-store), construite avec Express, TypeScript, Prisma (PostgreSQL) et Redis.

## 📋 Prérequis

- **Node.js** 18+
- **PostgreSQL** (une base accessible, ex: [Neon](https://neon.tech))
- **Redis** (ex: [Upstash](https://upstash.com))
- **Cloudflare R2** (ou compatible S3) pour le stockage des images — optionnel pour démarrer en local sans upload d'images

---

## 🚀 1. Installation

```bash
git clone <url-du-repo>
cd ecommerce-api
npm install
```

---

## ⚙️ 2. Configuration des variables d'environnement

Copie le fichier d'exemple :

```bash
cp .env.example .env
```

Remplis les valeurs dans `.env` :

```env
NODE_ENV=development
PORT=3000

# PostgreSQL — Neon.tech (ou toute instance Postgres)
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Redis — Upstash (ou toute instance Redis)
REDIS_URL=redis://default:password@host:port

# Cloudflare R2 (upload d'images) — optionnel en dev
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_PRODUCTS=products
R2_BUCKET_INVOICES=invoices
R2_PUBLIC_URL=

# Auth — génère une chaîne aléatoire d'au moins 32 caractères
JWT_SECRET=change_this_to_a_random_32char_string
JWT_EXPIRES_IN=3600

# Providers externes (non utilisés actuellement, laissés vides)
STRIPE_SECRET_KEY=
PAYDUNYA_API_KEY=
AFRICASTALKING_API_KEY=
RESEND_API_KEY=
```

> ⚠️ `JWT_SECRET` doit faire **au moins 32 caractères**, sinon le serveur refuse de démarrer (validation Zod dans `src/shared/config/env.ts`).

Pour les tests, crée aussi un `.env.test` (même structure, pointant idéalement vers une base de test séparée).

---

## 🗄️ 3. Base de données — migrations Prisma

Applique le schéma à ta base de données :

```bash
npx prisma migrate dev
```

Cette commande :

- crée les tables selon `prisma/schema.prisma`
- génère le client Prisma (`@prisma/client`)

Si tu modifies `schema.prisma` plus tard :

```bash
npx prisma migrate dev --name description_du_changement
```

Pour visualiser la base en local (optionnel) :

```bash
npx prisma studio
```

---

## 🌱 4. Peupler la base avec les données de seed

Le projet fournit des scripts de seed pour démarrer avec un catalogue de mobilier prêt à l'emploi. **L'ordre d'exécution est important** — chaque script dépend des données créées par le précédent.

### 4.1 Créer un compte admin

Nécessaire pour accéder aux routes protégées (`Admin`) une fois l'app lancée.

```bash
npm run seed:admin
```

Par défaut : `username=mon_admin`, `email=mon_admin@e-store.com`, `password=motdepassesecurise`.
Tu peux personnaliser :

```bash
npm run seed:admin -- mon_username mon_email@example.com mon_mot_de_passe
```

### 4.2 Peupler les settings (paramètres de l'application)

Initialise les paramètres configurables (devise, seuil de stock faible, méthodes de paiement actives, pays supportés, etc.) avec leurs valeurs par défaut.

```bash
npm run seed:settings
```

> Consultable ensuite via `GET /settings/public` (sans auth) ou `GET /settings` (admin).

### 4.3 Peupler le catalogue (catégories → produits → tags → promotions)

**Respecte impérativement cet ordre :**

```bash
npm run seed:categories   # Arbre de catégories (parent/enfant) : Salon, Chambre, Bureau...
npm run seed:products     # Produits, rattachés aux catégories créées ci-dessus
npm run seed:tags         # Tags (Nouveauté, Best-seller...) assignés aux produits par SKU
npm run seed:promotions   # Promotions, remises et coupons sur catégories/produits
```

Chaque script :

- est **idempotent** — relancer un script ne crée pas de doublons (vérifie l'existence par `slug`/`sku`/`code` avant insertion)
- affiche dans la console un résumé de ce qui a été créé ou ignoré

### 4.4 Tout peupler en une seule fois

Pour un premier démarrage complet, exécute dans l'ordre :

```bash
# Données existantes (rappel)
npm run seed:admin
npm run seed:settings
npm run seed:categories
npm run seed:products

npm run seed:warehouses       # entrepôts
npm run seed:attributes       # définitions d'attributs + options (couleur, matériau)
npm run seed:combinations     # variantes de produits (couleurs) — dépend d'attributes + products
npm run seed:inventory        # stock par produit/variante × entrepôt — dépend de warehouses + combinations
npm run seed:shipping-methods # méthodes de livraison (indépendant)
npm run seed:users            # clients de test + adresses (indépendant)

npm run seed:tags
npm run seed:promotions
```

---

## ▶️ 5. Démarrer l'application

### Mode développement (rechargement automatique)

```bash
npm run dev
```

Le serveur démarre sur `http://localhost:3000` (ou le `PORT` défini dans `.env`).

### Mode production

```bash
npm run build
npm start
```

`npm run build` compile TypeScript vers `dist/`, `npm start` lance `dist/server.js`.

### Vérifier que ça fonctionne

```bash
curl http://localhost:3000/settings/public
```

Doit renvoyer les settings publics (devise, pays supportés, méthodes de paiement) si `seed:settings` a été exécuté.

```bash
curl http://localhost:3000/product
```

Doit renvoyer la liste des produits — vide tant que les produits ne sont pas passés en statut `ACTIVE` (ils naissent en `DRAFT`, voir §7 ci-dessous).

---

## 🧪 6. Lancer les tests

```bash
npm test                  # tous les tests
npm run test:unit         # tests unitaires uniquement
npm run test:integration  # tests d'intégration uniquement (nécessite .env.test configuré)
npm run test:watch        # mode watch
```

---

## 📦 7. Activer les produits après le seed

Les produits créés par `seed:products` naissent en statut `DRAFT` (comportement volontaire de l'API — voir `product.service.ts`). Pour les rendre visibles publiquement, un admin doit les passer en `ACTIVE` :

```bash
curl -X PATCH http://localhost:3000/product/1 \
  -H "Authorization: Bearer <token_admin>" \
  -H "Content-Type: application/json" \
  -d '{"status": "ACTIVE"}'
```

> Récupère `<token_admin>` via `POST /login` avec les identifiants créés à l'étape 4.1.

---

## 📚 Documentation complémentaire

- **Endpoints & flux métier** : voir `GUIDE_INTEGRATION_API_FRONTEND.md`
- **Système d'événements internes** : voir `src/shared/events/README.md`
- **Module Settings** (paramètres configurables à chaud) : `GET /settings` (admin) pour la liste complète des clés disponibles

---

## 🗂️ Scripts disponibles (résumé)

| Commande                   | Description                                  |
| -------------------------- | -------------------------------------------- |
| `npm run dev`              | Démarre le serveur en mode développement     |
| `npm run build`            | Compile TypeScript                           |
| `npm start`                | Démarre le serveur compilé (production)      |
| `npm run seed:admin`       | Crée un compte administrateur                |
| `npm run seed:settings`    | Peuple les paramètres par défaut             |
| `npm run seed:categories`  | Crée l'arbre de catégories                   |
| `npm run seed:products`    | Crée les produits (nécessite les catégories) |
| `npm run seed:tags`        | Crée les tags et les assigne aux produits    |
| `npm run seed:promotions`  | Crée promotions, remises et coupons          |
| `npm test`                 | Lance tous les tests                         |
| `npm run test:unit`        | Tests unitaires uniquement                   |
| `npm run test:integration` | Tests d'intégration uniquement               |
