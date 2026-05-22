/**
 * HUKM — Crime category enum used by the home form, the model prompt,
 * and the lawyer-relevance heuristics. Keep in sync with
 * `CrimeCategory` in lib/types.ts.
 */

import type { CrimeCategory } from "./types";

export interface CrimeCategoryInfo {
  id: CrimeCategory;
  /** Translation key suffix; used as `t('crimeCategory.<id>')`. */
  i18nKey: string;
}

export const CRIME_CATEGORIES: ReadonlyArray<CrimeCategoryInfo> = [
  { id: "homicide", i18nKey: "homicide" },
  { id: "assault", i18nKey: "assault" },
  { id: "theft", i18nKey: "theft" },
  { id: "fraud", i18nKey: "fraud" },
  { id: "drug_offense", i18nKey: "drug_offense" },
  { id: "sexual_offense", i18nKey: "sexual_offense" },
  { id: "property_damage", i18nKey: "property_damage" },
  { id: "corruption", i18nKey: "corruption" },
  { id: "traffic_offense", i18nKey: "traffic_offense" },
  { id: "cybercrime", i18nKey: "cybercrime" },
  { id: "other", i18nKey: "other" },
];

export const CRIME_CATEGORY_IDS: ReadonlySet<CrimeCategory> = new Set(
  CRIME_CATEGORIES.map((c) => c.id),
);

export function isValidCrimeCategory(value: string): value is CrimeCategory {
  return CRIME_CATEGORY_IDS.has(value as CrimeCategory);
}
