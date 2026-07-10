export interface CountryEntry {
  code: string; // ISO 3166-1 alpha-2
  names: string[]; // libellés acceptés, en minuscules
}

export const SUPPORTED_COUNTRIES: CountryEntry[] = [
  { code: "CM", names: ["cameroon", "cameroun"] },
  { code: "FR", names: ["france"] },
  { code: "US", names: ["united states", "united states of america", "usa"] },
  { code: "GB", names: ["united kingdom", "uk", "great britain"] },
  { code: "SN", names: ["senegal", "sénégal"] },
  { code: "CI", names: ["côte d'ivoire", "cote d'ivoire", "ivory coast"] },
  { code: "NG", names: ["nigeria"] },
  { code: "GH", names: ["ghana"] },
];

const CODE_SET = new Set(SUPPORTED_COUNTRIES.map((c) => c.code));

/**
 * Normalise une entrée pays libre (code ISO ou libellé courant) vers son
 * code ISO 3166-1 alpha-2. Retourne null si le pays n'est pas reconnu.
 * C'est le SEUL point de résolution pays de l'app — country.trim() brut
 * ne doit plus jamais être persisté directement (cf. audit address).
 */
export const normalizeCountry = (input: string): string | null => {
  const trimmed = input.trim();
  const upper = trimmed.toUpperCase();
  if (CODE_SET.has(upper)) return upper;

  const lower = trimmed.toLowerCase();
  const match = SUPPORTED_COUNTRIES.find((c) => c.names.includes(lower));
  return match ? match.code : null;
};
