import { SettingType } from "@prisma/client";

export const SETTING_KEYS = {
  STORE_CURRENCY: "store.currency",
  STORE_SUPPORTED_COUNTRIES: "store.supported_countries",
  PAYMENTS_ENABLED_METHODS: "payments.enabled_methods",
  PAYMENTS_UNAVAILABLE_MESSAGES: "payments.unavailable_messages",
  INVENTORY_LOW_STOCK_THRESHOLD: "inventory.low_stock_threshold",
  LOYALTY_POINTS_PER_CURRENCY_UNIT: "loyalty.points_per_currency_unit",
  SECURITY_LOGIN_ATTEMPT_LIMIT: "security.login_attempt_limit",
  SECURITY_LOGIN_ATTEMPT_WINDOW_SECONDS:
    "security.login_attempt_window_seconds",
  ORDERS_STALE_PENDING_HOURS: "orders.stale_pending_hours",
  UPLOADS_MAX_FILE_SIZE_MB: "uploads.max_file_size_mb",
  UPLOADS_ALLOWED_MIME_TYPES: "uploads.allowed_mime_types",
  PAGINATION_DEFAULT_PAGE_SIZE: "pagination.default_page_size",
  CACHE_DEFAULT_TTL_SECONDS: "cache.default_ttl_seconds",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

interface DefaultSettingDefinition {
  key: string;
  value: string;
  type: SettingType;
  category: string;
  description: string;
  isPublic: boolean;
}

/**
 * Source de vérité unique pour les settings par défaut — utilisée par le
 * script de seed ET disponible comme référence pour toute future
 * fonctionnalité "réinitialiser aux valeurs par défaut".
 */
export const DEFAULT_SETTINGS: DefaultSettingDefinition[] = [
  {
    key: SETTING_KEYS.STORE_CURRENCY,
    value: "XAF",
    type: "STRING",
    category: "store",
    isPublic: true,
    description: "Devise utilisée dans toute l'application",
  },
  {
    key: SETTING_KEYS.STORE_SUPPORTED_COUNTRIES,
    value: JSON.stringify([
      { code: "CM", names: ["cameroon", "cameroun"] },
      { code: "FR", names: ["france"] },
      {
        code: "US",
        names: ["united states", "united states of america", "usa"],
      },
      { code: "GB", names: ["united kingdom", "uk", "great britain"] },
      { code: "SN", names: ["senegal", "sénégal"] },
      { code: "CI", names: ["côte d'ivoire", "cote d'ivoire", "ivory coast"] },
      { code: "NG", names: ["nigeria"] },
      { code: "GH", names: ["ghana"] },
    ]),
    type: "JSON",
    category: "store",
    isPublic: true,
    description: "Pays supportés pour les adresses et zones de livraison",
  },
  {
    key: SETTING_KEYS.PAYMENTS_ENABLED_METHODS,
    value: JSON.stringify(["CASH_ON_DELIVERY"]),
    type: "JSON",
    category: "payments",
    isPublic: true,
    description: "Méthodes de paiement actuellement disponibles",
  },
  {
    key: SETTING_KEYS.PAYMENTS_UNAVAILABLE_MESSAGES,
    value: JSON.stringify({
      PAYPAL: "PayPal payment is not available yet. Coming soon.",
      STRIPE: "Stripe payment is not available yet. Coming soon.",
      CINETPAY: "CinetPay payment is not available yet. Coming soon.",
    }),
    type: "JSON",
    category: "payments",
    isPublic: true,
    description:
      "Messages affichés pour les méthodes de paiement indisponibles",
  },
  {
    key: SETTING_KEYS.INVENTORY_LOW_STOCK_THRESHOLD,
    value: "10",
    type: "NUMBER",
    category: "inventory",
    isPublic: false,
    description: "Seuil déclenchant l'alerte LOW_STOCK",
  },
  {
    key: SETTING_KEYS.LOYALTY_POINTS_PER_CURRENCY_UNIT,
    value: "0.01",
    type: "NUMBER",
    category: "loyalty",
    isPublic: false,
    description:
      "Points de fidélité gagnés par unité de devise dépensée (1 pt / 100 XAF par défaut)",
  },
  {
    key: SETTING_KEYS.SECURITY_LOGIN_ATTEMPT_LIMIT,
    value: "5",
    type: "NUMBER",
    category: "security",
    isPublic: false,
    description:
      "Nombre d'échecs de connexion avant verrouillage automatique du compte",
  },
  {
    key: SETTING_KEYS.SECURITY_LOGIN_ATTEMPT_WINDOW_SECONDS,
    value: "900",
    type: "NUMBER",
    category: "security",
    isPublic: false,
    description:
      "Fenêtre glissante (secondes) pour le comptage des échecs de connexion",
  },
  {
    key: SETTING_KEYS.ORDERS_STALE_PENDING_HOURS,
    value: "24",
    type: "NUMBER",
    category: "orders",
    isPublic: false,
    description:
      "Délai (heures) avant annulation automatique d'une commande PENDING non payée",
  },
  {
    key: SETTING_KEYS.UPLOADS_MAX_FILE_SIZE_MB,
    value: "5",
    type: "NUMBER",
    category: "uploads",
    isPublic: true,
    description: "Taille maximale par fichier uploadé (Mo)",
  },
  {
    key: SETTING_KEYS.UPLOADS_ALLOWED_MIME_TYPES,
    value: JSON.stringify([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ]),
    type: "JSON",
    category: "uploads",
    isPublic: true,
    description: "Types MIME autorisés pour les uploads d'images",
  },
  {
    key: SETTING_KEYS.PAGINATION_DEFAULT_PAGE_SIZE,
    value: "20",
    type: "NUMBER",
    category: "pagination",
    isPublic: false,
    description: "Taille de page par défaut pour les listings",
  },
  {
    key: SETTING_KEYS.CACHE_DEFAULT_TTL_SECONDS,
    value: "300",
    type: "NUMBER",
    category: "cache",
    isPublic: false,
    description:
      "Durée de vie par défaut des entrées de cache Redis (secondes)",
  },
];
