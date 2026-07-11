import { settingService } from "../../modules/settings/setting.service";
import { SETTING_KEYS } from "../../modules/settings/setting.constants";

export interface CountryEntry {
  code: string; // ISO 3166-1 alpha-2
  names: string[]; // libellés acceptés, en minuscules
}

// Valeurs de repli utilisées tant que le cache des settings n'est pas encore
// chargé (avant le warmup() de server.ts, ou dans un script/test isolé).
const FALLBACK_SUPPORTED_COUNTRIES: CountryEntry[] = [
  { code: "CM", names: ["cameroon", "cameroun"] },
  { code: "FR", names: ["france"] },
  { code: "US", names: ["united states", "united states of america", "usa"] },
  { code: "GB", names: ["united kingdom", "uk", "great britain"] },
  { code: "SN", names: ["senegal", "sénégal"] },
  { code: "CI", names: ["côte d'ivoire", "cote d'ivoire", "ivory coast"] },
  { code: "NG", names: ["nigeria"] },
  { code: "GH", names: ["ghana"] },
];

/**
 * Normalise une entrée pays libre (code ISO ou libellé courant) vers son
 * code ISO 3166-1 alpha-2. Retourne null si le pays n'est pas reconnu.
 * C'est le SEUL point de résolution pays de l'app.
 *
 * La liste des pays supportés vient désormais du module Settings
 * (store.supported_countries) — modifiable à chaud par un admin, sans
 * redéploiement. Lecture SYNCHRONE (getJSONSync) car cette fonction est
 * appelée depuis des contextes synchrones (ex: .refine() de schémas Zod).
 */
export const normalizeCountry = (input: string): string | null => {
  const countries = settingService.getJSONSync<CountryEntry[]>(
    SETTING_KEYS.STORE_SUPPORTED_COUNTRIES,
    FALLBACK_SUPPORTED_COUNTRIES,
  );

  const trimmed = input.trim();
  const upper = trimmed.toUpperCase();
  const codeSet = new Set(countries.map((c) => c.code));
  if (codeSet.has(upper)) return upper;

  const lower = trimmed.toLowerCase();
  const match = countries.find((c) => c.names.includes(lower));
  return match ? match.code : null;
};
